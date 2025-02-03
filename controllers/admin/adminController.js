
const Admin = require("../../models/adminModel");
const Order = require('../../models/orderModel');
const User = require('../../models/userModel');
const Product = require("../../models/productModel");
const Offer = require("../../models/offerModel")
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

//admin loadlogin
const loadLogin=(req,res)=>
{
    res.render("adminlog",{message:null})
}


//admin login
const login = async (req, res) => {
    try {
      const { email, password } = req.body;
      const admin = await Admin.findOne({ email });

      if (admin) {
        if (password === admin.password) {
          req.session.admin = true;
          return res.redirect("/admin");
          
        } else {
          return res.render("adminlog", { message: "Incorrect password. Please try again."});
        }

        
      } else {
        return res.render("adminlog", { message: "Incorrect email. Please try again." });
      }
    } catch (error) {
      console.error("Login error", error);
      return res.redirect("/pageerror");
    }
  };


//logout admin
const logoutAdmin=async(req,res)=>{
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Error logging out');
    }
    res.redirect('/admin/login');
  });
  
}


//admindashboard
const loadDashboard = async (req, res) => {
  if (req.session.admin) {
      try {
         
          const totalOrders = await Order.countDocuments();
          const totalProducts = await Product.countDocuments();
          
          const orders = await Order.find();
          let totalRevenue = 0;
          let totalDiscount = 0;

          orders.forEach(order => {
              totalRevenue += order.items.reduce((sum, item) => sum + item.finalPrice, 0);
              if (order.discount) {
                  totalDiscount += order.discount;
              }
          });
          const currentDate = new Date();
          const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const monthlyOrders = await Order.find({
              createdAt: { $gte: firstDayOfMonth }
          });
          
          const monthlyEarning = monthlyOrders.reduce((sum, order) => 
              sum + order.items.reduce((itemSum, item) => itemSum + item.finalPrice, 0), 0);

          res.render("dashboard", {
              totalOrders,
              totalProducts,
              totalRevenue,
              monthlyEarning,
              totalDiscount
          });
      } catch (error) {
          res.redirect("/pageerror");
      }
  }
};



//page Error
const pageerror=async(req,res)=>{
    res.render("adminerror")
}

//orderlist
const loadOrdersList = async (req, res) => {
  try {
      const { search = '', page = 1 } = req.query;
      const limit = 5;
      const skip = (page - 1) * limit;

      const searchTerm = search.trim();

      const currentDate = new Date();
      const offers = await Offer.find({
          status: 'Active',
          expireDate: { $gt: currentDate }
      });

      let orders = [];
      let totalOrders = 0;

      if (searchTerm) {
          const matchingUsers = await User.find({
              name: { $regex: searchTerm, $options: 'i' }
          }).select('_id');

          const userIds = matchingUsers.map(user => user._id);

          const searchCriteria = {
              $or: [
                  { orderId: { $regex: searchTerm, $options: 'i' } },
                  { paymentMethod: { $regex: searchTerm, $options: 'i' } },
                  { paymentStatus: { $regex: searchTerm, $options: 'i' } },
                  { orderStatus: { $regex: searchTerm, $options: 'i' } },
                  { userId: { $in: userIds } }
              ]
          };

          totalOrders = await Order.countDocuments(searchCriteria);

          orders = await Order.find(searchCriteria)
              .sort({ createdAt: -1 })
              .skip(skip)
              .limit(limit)
              .lean();
      } else {
          totalOrders = await Order.countDocuments();
          orders = await Order.find()
              .sort({ createdAt: -1 })
              .skip(skip)
              .limit(limit)
              .lean();
      }

      const formattedOrders = await Promise.all(
          orders.map(async (order) => {
              const customerName = await getCustomerName(order.userId);
              let subtotal = 0;
              let activeItemsCount = 0;

              const itemsWithPricing = order.items.map(item => {
                  if (item.itemStatus !== 'Cancelled') {
                      activeItemsCount++;
                      
                      const productOffer = offers.find(offer =>
                          (offer.productIds?.includes(item.productId)) ||
                          (offer.categoryIds?.includes(item.category))
                      );

                      const priceAfterOffer = productOffer
                          ? item.price * (1 - productOffer.discount / 100)
                          : item.price;

                      const finalItemPrice = item.finalPrice || priceAfterOffer;
                      subtotal += finalItemPrice * item.quantity;

                      return {
                          ...item,
                          originalPrice: item.price,
                          finalPrice: finalItemPrice,
                          offerDiscount: productOffer ? productOffer.discount : 0
                      };
                  }
                  return item;
              });

              let finalTotal = subtotal;
              let couponDiscount = 0;
              if (order.appliedCoupon && activeItemsCount > 0) {
                  couponDiscount = (subtotal / order.totalPrice) * order.appliedCoupon.discountAmount;
                  finalTotal = subtotal - couponDiscount;
              }

              const highestDiscount = Math.max(
                  ...itemsWithPricing
                      .filter(item => item.offerDiscount)
                      .map(item => item.offerDiscount),
                  order.appliedCoupon ? (couponDiscount / subtotal * 100) : 0
              );

              const hasReturnRequest = order.items.some(item =>
                  item.returnStatus &&
                  ['Return Requested', 'Return Accepted'].includes(item.returnStatus)
              );

              return {
                  _id: order._id,
                  orderId: order.orderId,
                  orderDate: new Date(order.createdAt).toLocaleDateString('en-GB'),
                  customerName: customerName || "Unknown Customer",
                  subtotal: subtotal.toFixed(2),
                  couponDiscount: couponDiscount.toFixed(2),
                  totalPrice: finalTotal.toFixed(2),
                  originalPrice: order.totalPrice.toFixed(2),
                  highestDiscount: highestDiscount.toFixed(1),
                  appliedCoupon: order.appliedCoupon,
                  paymentMethod: order.paymentMethod,
                  orderStatus: order.orderStatus,
                  paymentStatus: order.paymentStatus,
                  hasReturnRequest: hasReturnRequest,
                  returnItems: order.items.filter(item =>
                      item.returnStatus &&
                      ['Return Requested', 'Return Accepted'].includes(item.returnStatus)
                  ).map(item => ({
                      ...item,
                      returnDisplayStatus: item.returnStatus === 'Return Accepted' ? 'Accepted' :
                          item.returnStatus === 'Return Rejected' ? 'Rejected' :
                              'Requested'
                  }))
              };
          })
      );

      const pagination = {
          totalPages: Math.ceil(totalOrders / limit),
          currentPage: Number(page),
          hasNextPage: Number(page) < Math.ceil(totalOrders / limit),
          hasPrevPage: Number(page) > 1,
          nextPage: Number(page) + 1,
          prevPage: Number(page) - 1,
          totalOrders: totalOrders,
          ordersPerPage: limit,
          startOrder: skip + 1,
          endOrder: Math.min(skip + limit, totalOrders)
      };

      res.render('orders', {
          orders: formattedOrders,
          pagination,
          search: searchTerm
      });
  } catch (error) {
      console.error('Error in loadOrdersList:', error);
      res.status(500).render('error', {
          message: 'An error occurred while fetching the orders list',
          error: process.env.NODE_ENV === 'development' ? error : {}
      });
  }
};

async function getCustomerName(userId) {
  try {
    const user = await User.findById(userId).select('name');
    return user ? user.name:'Unknown Customer';
  } catch (error) {
    console.error('Error fetching customer name:', error);
    return null;
  }
};


//return status update
const updateReturnStatus = async (req, res) => {
  try {
    const { fullOrderId, returnItems, status } = req.body;

    if (!['Accepted', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid return status'
      });
    }

    const order = await Order.findById(fullOrderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const updatedItems = order.items.map(item => {
      const returnItem = returnItems.find(
        r => r.productId.toString() === item.productId.toString()
      );
      
      if (returnItem) {
        const newReturnStatus= status === 'Accepted' ? 'Return Accepted' : 'Return Rejected';
          
      item.returnStatus = newReturnStatus;
      item.isApproved = status === 'Accepted';
    }
      return item;
    });

    order.items = updatedItems;

    const processingReturns = order.items.filter(item => item.returnReason);

    const allItemsProcessed = processingReturns.every(
      item =>  ['Return Accepted', 'Return Rejected'].includes(item.returnStatus)
    );

    if (allItemsProcessed) {
      const hasAcceptedReturns = order.items.some(
        item => item.returnStatus === 'Return Accepted'
      );
      order.orderStatus = hasAcceptedReturns ? 'Returned' : 'Delivered';
    }
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Return status updated successfully',
      updatedItems: order.items.filter(item => item.returnReason)
    });

  } catch (error) {
    console.error('Detailed Error in updateReturnStatus:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating return status',
      errorDetails: error.message
    });
  }
};

//orderdetails page 
const adminOrderDetails = async (req, res) => {
  try {
      const { orderId } = req.params;
      
      const currentDate = new Date();
      const offers = await Offer.find({
          status: 'Active',
          expireDate: { $gt: currentDate }
      });

      const order = await Order.findOne({ orderId })
          .populate({
              path: 'items.productId',
              model: 'Product',
              populate: {
                  path: 'category',
                  model: 'Category',
                  select: 'name'
              },
              select: 'productName category productImage isBlocked'
          });

      if (!order) {
          return res.status(404).render('error', {
              message: 'Order not found',
              error: { status: 404 }
          });
      }

      const customer = await User.findById(order.userId).select('name email phone');

      let activeSubtotal = 0;
      let activeItemsCount = 0;

      const processedItems = order.items.map(item => {
          const productOffer = offers.find(offer => 
              (offer.productIds?.includes(item.productId?._id)) ||
              (offer.categoryIds?.includes(item.productId?.category))
          );

          const highestDiscount = productOffer ? productOffer.discount : 0;
          const offerPrice = productOffer 
              ? item.price * (1 - productOffer.discount / 100)
              : item.price;
          
          const itemFinalPrice = productOffer 
              ? item.quantity * offerPrice 
              : item.finalPrice;

          if (item.itemStatus !== 'Cancelled') {
              activeSubtotal += itemFinalPrice;
              activeItemsCount++;
          }

          return {
              productId: item.productId?._id || '',
              productName: item.productId?.productName || 'Product Unavailable',
              category: item.productId?.category?.name || 'Uncategorized',
              image: item.productId?.productImage?.[0] 
                  ? `/uploads/cropped/${item.productId.productImage[0]}` 
                  : '/placeholder-image.jpg',
              quantity: item.quantity,
              price: item.price.toFixed(2),
              offerPrice: offerPrice.toFixed(2),
              highestDiscount,
              finalPrice: itemFinalPrice.toFixed(2),
              status: item.itemStatus,
              isAvailable: !item.productId?.isBlocked
          };
      });


      let finalTotal = activeSubtotal;
      let appliedCouponInfo = null;

      if (order.appliedCoupon && activeItemsCount > 0) {
          const proportionalDiscount = (activeSubtotal / order.totalPrice) * order.appliedCoupon.discountAmount;
          finalTotal = activeSubtotal - proportionalDiscount;

          appliedCouponInfo = {
              code: order.appliedCoupon.code,
              originalDiscount: order.appliedCoupon.discountAmount,
              appliedDiscount: proportionalDiscount.toFixed(2)
          };
      }

      const formattedOrder = {
          orderId: order.orderId,
          orderDate: new Date(order.createdAt).toLocaleDateString('en-GB'),
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          customer: {
              name: customer?.name || 'Unknown Customer',
              email: customer?.email || 'N/A',
              phone: customer?.phone || 'N/A'
          },
          address: order.address,
          items: processedItems,
          subtotal: activeSubtotal.toFixed(2),
          appliedCoupon: appliedCouponInfo,
          finalTotal: finalTotal.toFixed(2)
      };

      res.render('adminOrderDetails', { order: formattedOrder });

  } catch (error) {
      console.error('Error in adminOrderDetails:', error);
      res.status(500).render('error', {
          message: 'An error occurred while fetching order details',
          error: process.env.NODE_ENV === 'development' ? error : {}
      });
  }
};

//update orderstatus
const updateOrderStatus = async (req, res) => {
  try {
      const { orderId, productId, status } = req.body;

      const [order, product] = await Promise.all([
        Order.findOne({ orderId }),
        Product.findById(productId)
    ]);

    if (!order) {
      return res.status(404).json({
          success: false,
          message: 'Order not found'
      });
  }

  if (!product) {
      return res.status(404).json({
          success: false,
          message: 'Product not found'
      });
  }

      const itemIndex = order.items.findIndex(item => 
          item.productId.toString() === productId
      );

      if (itemIndex === -1) {
          return res.status(404).json({
              success: false,
              message: 'Product not found in order'
          });
      }

      const item = order.items[itemIndex];
      const oldStatus = item.itemStatus;
      
      if (status === 'Cancelled' && oldStatus !== 'Cancelled') {
            product.quantity += item.quantity;
            await product.save();
        }

      order.items[itemIndex].itemStatus = status;

      const allItemStatuses = order.items.map(item => item.itemStatus);

      if (status === 'Cancelled' && 
          (order.paymentMethod !== 'COD' && order.paymentStatus === 'Paid')) {
          order.paymentStatus = 'Refund Pending';
      }

      await order.save();

      res.status(200).json({
          success: true,
          message: 'Order status updated successfully'
      });

  } catch (error) {
      console.error('Error in updateOrderStatus:', error);
      res.status(500).json({
          success: false,
          message: 'An error occurred while updating the order status'
      });
  }
};


const updateAllProductsStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;

    if (!['Processing', 'Shipped', 'Delivered'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    order.items = order.items.map(item => {
      if (item.itemStatus !== 'Cancelled') {
        item.itemStatus = status;
      }
      return item;
    });

    const nonCancelledItems = order.items.filter(item => item.itemStatus !== 'Cancelled');
    if (nonCancelledItems.length > 0) {
      order.orderStatus = status;
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully'
    });

  } catch (error) {
    console.error('Error in updateAllProductsStatus:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating the order status'
    });
  }
};

//cancel all order
const cancelAllProducts = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const productUpdates = order.items.map(async (item) => {
      if (item.itemStatus !== 'Cancelled') {
        const product = await Product.findById(item.productId);
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        }
        item.itemStatus = 'Cancelled';
      }
      return item;
    });

    await Promise.all(productUpdates);
    order.orderStatus = 'Cancelled';

    if (order.paymentMethod !== 'COD' && order.paymentStatus === 'Paid') {
      order.paymentStatus = 'Refund Pending';
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: 'All products cancelled successfully'
    });

  } catch (error) {
    console.error('Error in cancelAllProducts:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while cancelling the products'
    });
  }
};

const generateSalesReport = async (req, res) => {
  try {
      const { startDate, endDate, reportType } = req.query;
      let dateQuery = {};

      if (reportType === 'daily') {
          const today = new Date();
          dateQuery = {
              createdAt: {
                  $gte: new Date(today.setHours(0, 0, 0, 0)),
                  $lt: new Date(today.setHours(23, 59, 59, 999))
              }
          };
      } else if (reportType === 'weekly') {
          const lastWeek = new Date(new Date().setDate(new Date().getDate() - 7));
          dateQuery = { createdAt: { $gte: lastWeek } };
      } else if (reportType === 'monthly') {
          const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1));
          dateQuery = { createdAt: { $gte: lastMonth } };
      } else if (reportType === 'custom' && startDate && endDate) {
          dateQuery = {
              createdAt: {
                  $gte: new Date(startDate),
                  $lte: new Date(endDate)
              }
          };
      }

      const orders = await Order.find(dateQuery)
          .populate('userId', 'name')
          .sort({ createdAt: -1 });

      if (req.query.download === 'excel') {
          return await downloadExcel(orders, res);
      } else if (req.query.download === 'pdf') {
          return await downloadPDF(orders, res);
      }

      const report = orders.map(order => ({
          orderId: order.orderId,
          customerName: order.userId?.name || 'Unknown',
          date: order.createdAt.toLocaleDateString(),
          total: order.items.reduce((sum, item) => sum + item.finalPrice, 0),
          discount: order.discount || 0,
          finalAmount: order.items.reduce((sum, item) => sum + item.finalPrice, 0) - (order.discount || 0)
      }));

      res.json({
          success: true,
          report,
          summary: {
              totalOrders: orders.length,
              totalAmount: report.reduce((sum, order) => sum + order.finalAmount, 0),
              totalDiscount: report.reduce((sum, order) => sum + order.discount, 0)
          }
      });

  } catch (error) {
      console.error('Error generating sales report:', error);
      res.status(500).json({ success: false, message: 'Error generating report' });
  }
};

// functions for downloading reports
async function downloadExcel(orders, res) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sales Report');

  worksheet.columns = [
      { header: 'Order ID', key: 'orderId' },
      { header: 'Customer', key: 'customer' },
      { header: 'Date', key: 'date' },
      { header: 'Total', key: 'total' },
      { header: 'Discount', key: 'discount' },
      { header: 'Final Amount', key: 'final' }
  ];

  orders.forEach(order => {
      worksheet.addRow({
          orderId: order.orderId,
          customer: order.userId?.name || 'Unknown',
          date: order.createdAt.toLocaleDateString(),
          total: order.items.reduce((sum, item) => sum + item.finalPrice, 0),
          discount: order.discount || 0,
          final: order.items.reduce((sum, item) => sum + item.finalPrice, 0) - (order.discount || 0)
      });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

  await workbook.xlsx.write(res);
}

async function downloadPDF(orders, res) {
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
  doc.pipe(res);

  doc.fontSize(16).text('Sales Report', { align: 'center' });
  doc.moveDown();

  orders.forEach(order => {
      doc.fontSize(12).text(`Order ID: ${order.orderId}`);
      doc.fontSize(10).text(`Customer: ${order.userId?.name || 'Unknown'}`);
      doc.text(`Date: ${order.createdAt.toLocaleDateString()}`);
      doc.text(`Total: $${order.items.reduce((sum, item) => sum + item.finalPrice, 0)}`);
      doc.text(`Discount: $${order.discount || 0}`);
      doc.text(`Final Amount: $${order.items.reduce((sum, item) => sum + item.finalPrice, 0) - (order.discount || 0)}`);
      doc.moveDown();
  });

  doc.end();
}

module.exports={
    loadLogin,
    login,
    logoutAdmin,
    loadDashboard,
    pageerror,
    loadOrdersList,
    updateReturnStatus,
    adminOrderDetails,
    updateOrderStatus,
    updateAllProductsStatus,
    cancelAllProducts,
    generateSalesReport
}