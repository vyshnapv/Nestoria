
const Admin = require("../../models/adminModel");
const Order = require('../../models/orderModel');
const User = require('../../models/userModel');
const Category= require('../../models/categoryModel');
const Coupon= require('../../models/couponModel')
const Product = require("../../models/productModel");
const Offer = require("../../models/offerModel")
const Wallet = require("../../models/walletModel")
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
              let originalSubtotal = 0;
              let activeItemsCount = 0;

              const itemsWithPricing = order.items.map(item => {
                const productOffer = offers.find(offer =>
                  (offer.productIds?.includes(item.productId)) ||
                  (offer.categoryIds?.includes(item.category))
              );
  
              const priceAfterOffer = productOffer
                  ? item.price * (1 - productOffer.discount / 100)
                  : item.price;
  
              const finalItemPrice = item.finalPrice || priceAfterOffer;
              originalSubtotal += finalItemPrice; 
  
              if (item.itemStatus !== 'Cancelled') {
                  activeItemsCount++;
                  subtotal += finalItemPrice;
              }
              
              return {
                ...item,
                originalPrice: item.price,
                finalPrice: finalItemPrice,
                offerDiscount: productOffer ? productOffer.discount : 0
            };
        });

        const allCancelled = activeItemsCount === 0;

        let finalTotal;
        let couponDiscount = 0;
        const shippingCharge = 50;

        if (allCancelled) {
          finalTotal = originalSubtotal + shippingCharge;
        } else {
          finalTotal = subtotal;
          
          if (order.appliedCoupon && activeItemsCount > 0) {
              couponDiscount = (subtotal / order.totalPrice) * order.appliedCoupon.discountAmount;
              finalTotal = subtotal - couponDiscount + shippingCharge;
          } else {
              finalTotal = subtotal + shippingCharge;
          }
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
              shippingCharge: shippingCharge.toFixed(2),
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

//helper function for getcustomer name
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
      let originalSubtotal = 0;
      let activeItemsCount = 0;

      const processedItems = order.items.map(item => {
          const productOffer = offers.find(offer => 
              (offer.productIds?.includes(item.productId?._id)) ||
              (offer.categoryIds?.includes(item.productId?.category))
          );

          const highestDiscount = productOffer ? productOffer.discount : 0;
          const offerPrice = productOffer 
              ? Math.round(item.price * (1 - productOffer.discount / 100))
              : item.price;
          
          const itemFinalPrice = productOffer 
              ? item.quantity * offerPrice 
              : item.finalPrice;

              originalSubtotal += parseFloat(item.finalPrice);

          if (item.itemStatus !== 'Cancelled') {
            activeSubtotal += parseFloat(item.finalPrice);
            activeItemsCount++;
          }

          return {
              productId: item.productId?._id || '',
              productName: item.productId?.productName || 'Product Unavailable',
              category: item.productId?.category?.name || 'Uncategorized',
              image: item.productId?.productImage?.[0] 
                  ? `/uploads/${item.productId.productImage[0]}` 
                  : '/placeholder-image.jpg',
              quantity: item.quantity,
              price: item.price.toFixed(2),
              offerPrice: offerPrice.toFixed(2),
              highestDiscount: productOffer ? productOffer.discount : 0,
              finalPrice: item.finalPrice.toFixed(2),
              status: item.itemStatus,
              isAvailable: !item.productId?.isBlocked
          };
      });


      let finalTotal = originalSubtotal;
      const shippingCharge = order.deliveryCharge || 50;
      let appliedCouponInfo = null;

      if (order.appliedCoupon) {
        const proportionalDiscount = order.appliedCoupon.discountAmount;
        finalTotal = originalSubtotal - proportionalDiscount;

        appliedCouponInfo = {
            code: order.appliedCoupon.code,
            originalDiscount: order.appliedCoupon.discountAmount,
            appliedDiscount: proportionalDiscount.toFixed(2)
        }
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
          shippingCharge: shippingCharge.toFixed(2),
          appliedCoupon: appliedCouponInfo,
          finalTotal: (finalTotal + shippingCharge).toFixed(2),
          allCancelled: activeItemsCount === 0
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
        
        if (order.paymentMethod !== 'COD' && order.paymentStatus === 'Paid') {
          const refundAmount = parseFloat(item.finalPrice);
          let wallet = await Wallet.findOne({ userId: order.userId });
          if (!wallet) {
            wallet = new Wallet({ 
              userId: order.userId,
              balance: 0,
              transactions: []
            });
          }

          wallet.balance += refundAmount;
          
          wallet.transactions.push({
            amount: refundAmount,
            type: 'credit',
            description: `Refund for canceled product ${item.productName} in order #${order.orderId}`,
            orderId: order._id,
            balance: wallet.balance
          });
   
          await wallet.save();
        }
      }

      order.items[itemIndex].itemStatus = status;

      const allItemsStatus = order.items.map(item => item.itemStatus);
      const allCancelled = allItemsStatus.every(status => status === 'Cancelled');
      
      if (allCancelled) {
        order.orderStatus = 'Cancelled';
        if (order.paymentMethod !== 'COD' && order.paymentStatus === 'Paid') {
          order.paymentStatus = 'Refunded';
        }
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

//updateallproductstatus 
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

    order.originalTotalPrice = order.totalPrice;

    if (order.paymentMethod !== 'COD' && order.paymentStatus === 'Paid') {
      const refundAmount = parseFloat(order.totalPrice);

      let wallet = await Wallet.findOne({ userId: order.userId });
      if (!wallet) {
        wallet = new Wallet({ 
          userId: order.userId,
          balance: 0,
          transactions: []
        });
      }

      wallet.balance += refundAmount;
      wallet.transactions.push({
        amount: refundAmount,
        type: 'credit',
        description: `Refund for canceled order #${order.orderId}`,
        orderId: order._id,
        balance: wallet.balance
      });
      await wallet.save();
      
      order.paymentStatus = 'Refunded';
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

//generate sales report 
const generateSalesReport = async (req, res) => {
  try {
      const { startDate, endDate, reportType } = req.query;
      let dateQuery = {};
      let previousPeriodQuery = {};

      const statusFilter = {
        orderStatus: { 
            $nin: ['Cancelled', 'Returned'] 
        }
      };
      if (reportType === 'daily') {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        dateQuery = {
            createdAt: {
                $gte: new Date(today.setHours(0, 0, 0, 0)),
                $lt: new Date(today.setHours(23, 59, 59, 999))
            },
            ...statusFilter
        };
        previousPeriodQuery = {
            createdAt: {
                $gte: new Date(yesterday.setHours(0, 0, 0, 0)),
                $lt: new Date(yesterday.setHours(23, 59, 59, 999))
            },
            ...statusFilter
        };
    } else if (reportType === 'weekly') {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        
        const previousWeekStart = new Date(weekStart);
        previousWeekStart.setDate(previousWeekStart.getDate() - 7);
        const previousWeekEnd = new Date(weekStart);
        previousWeekEnd.setSeconds(previousWeekEnd.getSeconds() - 1);

        dateQuery = {
            createdAt: {
                $gte: new Date(weekStart.setHours(0, 0, 0, 0)),
                $lt: new Date(today.setHours(23, 59, 59, 999))
            },
            ...statusFilter
        };
        previousPeriodQuery = {
            createdAt: {
                $gte: new Date(previousWeekStart.setHours(0, 0, 0, 0)),
                $lt: new Date(previousWeekEnd)
            },
            ...statusFilter
        };
    } else if (reportType === 'monthly') {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

        dateQuery = {
            createdAt: {
                $gte: new Date(monthStart.setHours(0, 0, 0, 0)),
                $lt: new Date(today.setHours(23, 59, 59, 999))
            },
            ...statusFilter
        };
        previousPeriodQuery = {
            createdAt: {
                $gte: new Date(previousMonthStart.setHours(0, 0, 0, 0)),
                $lt: new Date(previousMonthEnd.setHours(23, 59, 59, 999))
            },
            ...statusFilter
        };
    } else if (reportType === 'yearly') {
        const today = new Date();
        const yearStart = new Date(today.getFullYear(), 0, 1);
        
        const previousYearStart = new Date(today.getFullYear() - 1, 0, 1);
        const previousYearEnd = new Date(today.getFullYear(), 0, 0);

        dateQuery = {
            createdAt: {
                $gte: new Date(yearStart.setHours(0, 0, 0, 0)),
                $lt: new Date(today.setHours(23, 59, 59, 999))
            },
            ...statusFilter
        };
        previousPeriodQuery = {
            createdAt: {
                $gte: new Date(previousYearStart.setHours(0, 0, 0, 0)),
                $lt: new Date(previousYearEnd.setHours(23, 59, 59, 999))
            },
            ...statusFilter
        };
    } else if (reportType === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        
        const previousStart = new Date(start);
        previousStart.setDate(previousStart.getDate() - daysDiff);
        const previousEnd = new Date(start);
        previousEnd.setSeconds(previousEnd.getSeconds() - 1);

        dateQuery = {
            createdAt: {
                $gte: new Date(start.setHours(0, 0, 0, 0)),
                $lt: new Date(end.setHours(23, 59, 59, 999))
            },
            ...statusFilter
        };
        previousPeriodQuery = {
            createdAt: {
                $gte: new Date(previousStart.setHours(0, 0, 0, 0)),
                $lt: new Date(previousEnd)
            },
            ...statusFilter
        };
    }

      const currentOrders = await Order.find(dateQuery)
      .populate('userId', 'name')
      .populate({
          path: 'items.productId',
          populate: {
            path: 'category'
          }
      })

      const calculateValidOrderAmount = (order) => {
        return order.items.reduce((sum, item) => {
            if (item.itemStatus !== 'Cancelled' && item.itemStatus !== 'Returned') {
                return sum + item.finalPrice;
            }
            return sum;
        }, 0);
    };

      const currentCustomers = await User.distinct('_id', { 
        _id: { $in: currentOrders.map(order => order.userId) } 
    });

    const previousOrders = await Order.find(previousPeriodQuery);
    const previousCustomers = await User.distinct('_id', { 
        _id: { $in: previousOrders.map(order => order.userId) } 
    });

  
     const currentRevenue = currentOrders.reduce((sum, order) => 
            sum + calculateValidOrderAmount(order), 0);

     const previousRevenue = previousOrders.reduce((sum, order) => 
      sum + calculateValidOrderAmount(order), 0);
  
     const currentDiscount = currentOrders.reduce((sum, order) => {
      let totalDiscount = 0;
      order.items.forEach(item => {
        if (item.itemStatus !== 'Cancelled' && item.itemStatus !== 'Returned') {
            const originalPrice = item.price * item.quantity;
            const finalPrice = item.finalPrice;
            const itemDiscount = originalPrice - finalPrice;
            
            if (itemDiscount > 0) {
                totalDiscount += itemDiscount;
            }
        }
    }); 
    if (order.discount && order.items.some(item => 
      item.itemStatus !== 'Cancelled' && item.itemStatus !== 'Returned')) {
         totalDiscount += order.discount;
       }
      return sum + totalDiscount;
    }, 0);
     
   const stats = {
       revenue: {
          current: currentRevenue,
          change: previousRevenue ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0
       },
       orders: {
          current: currentOrders.length,
          change: previousOrders.length ? 
              ((currentOrders.length - previousOrders.length) / previousOrders.length) * 100 : 0
       },
       customers: {
          current: currentCustomers.length,
          change: previousCustomers.length ? 
              ((currentCustomers.length - previousCustomers.length) / previousCustomers.length) * 100 : 0
       },
       discounts: {
          current: currentDiscount
       }
    };
      const orders = await Order.find(dateQuery)
            .populate('userId', 'name')
            .populate({
                path: 'items.productId',
                populate: {
                    path: 'category'
                }
            })
            .sort({ createdAt: -1 });
            const salesData = await generateSalesData(dateQuery);

            const productSales = {};
            currentOrders.forEach(order => {
                order.items.forEach(item => {
                    if (item.itemStatus !== 'Cancelled' && item.itemStatus !== 'Returned') {
                        if (!productSales[item.productId]) {
                            productSales[item.productId] = {
                                name: item.productName,
                                unitsSold: 0,
                                revenue: 0
                            };
                        }
                        productSales[item.productId].unitsSold += item.quantity;
                        productSales[item.productId].revenue += item.finalPrice;
                    }
                });
            });
    
            const topProducts = Object.values(productSales)
                .sort((a, b) => b.unitsSold - a.unitsSold)
                .slice(0, 10);
    
            const categorySales = {};
            let totalSales = 0;
    
            currentOrders.forEach(order => {
              order.items.forEach(item => {
                  if (item.itemStatus !== 'Cancelled' && item.itemStatus !== 'Returned' && 
                      item.productId && item.productId.category) {
                      const categoryName = item.productId.category.name;
                      if (!categorySales[categoryName]) {
                          categorySales[categoryName] = 0;
                      }
                      categorySales[categoryName] += item.finalPrice;
                      totalSales += item.finalPrice;
                  }
              });
          });
    
            const topCategories = Object.entries(categorySales)
                .map(([name, sales]) => ({
                    name,
                    sales,
                    percentage: ((sales / totalSales) * 100).toFixed(1)
                }))
                .sort((a, b) => b.sales - a.sales)
                .slice(0, 9);
      
                if (req.query.download === 'excel') {
                   return await downloadExcel(orders, topProducts, topCategories, res);
                } else if (req.query.download === 'pdf') {
                   return await downloadPDF(orders, topProducts, topCategories, res);
                }
      

                const report = currentOrders.map(order => {
                  const validItems = order.items.filter(item => 
                      item.itemStatus !== 'Cancelled' && item.itemStatus !== 'Returned'
                  );
      
                  const totalBeforeDiscount = validItems.reduce((sum, item) => 
                      sum + (item.price * item.quantity), 0);
                  const totalAfterDiscount = validItems.reduce((sum, item) => 
                      sum + item.finalPrice, 0);
                  const itemLevelDiscount = totalBeforeDiscount - totalAfterDiscount;
      
                  const orderDiscount = validItems.length > 0 ? (order.discount || 0) : 0;
                  const totalDiscount = orderDiscount + itemLevelDiscount;
                  const shippingCharge = validItems.length > 0 ? 50 : 0;
      
                  return {
                      orderId: order.orderId,
                      customerName: order.userId?.name || 'Unknown',
                      date: order.createdAt.toLocaleDateString(),
                      total: totalBeforeDiscount,
                      discount: totalDiscount,
                      shippingCharge: shippingCharge,
                      finalAmount: totalAfterDiscount - orderDiscount + shippingCharge
                  };
              });
              const summary = {
                totalOrders: currentOrders.length,
                totalAmount: report.reduce((sum, order) => sum + order.total, 0),
                totalDiscount: report.reduce((sum, order) => sum + order.discount, 0),
                totalShipping: report.reduce((sum, order) => sum + order.shippingCharge, 0),
                finalTotal: report.reduce((sum, order) => sum + order.finalAmount, 0)
            };

            if (req.query.download === 'excel') {
              return await downloadExcel(currentOrders, topProducts, topCategories, res);
          } else if (req.query.download === 'pdf') {
              return await downloadPDF(currentOrders, topProducts, topCategories, res);
          }

         res.json({
           success: true,
           stats,
           report,
           topProducts,
           topCategories,
           salesData,
           summary
         });

  } catch (error) {
      console.error('Error generating sales report:', error);
      res.status(500).json({ success: false, message: 'Error generating report' });
  }
};

//helper function for generate sales data
async function generateSalesData(dateQuery) {
    const orders = await Order.find(dateQuery).sort('createdAt');
    const salesMap = new Map();
  
    orders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0];
      if (!salesMap.has(date)) {
          salesMap.set(date, {
              sales: 0,
              orders: 0
          });
      }
      const dayData = salesMap.get(date);
      const validSales = order.items.reduce((sum, item) => {
        if (item.itemStatus !== 'Cancelled' && item.itemStatus !== 'Returned') {
            return sum + item.finalPrice;
        }
        return sum;
      }, 0);

      dayData.sales += validSales;
        if (validSales > 0) {
          dayData.orders += 1;
        }
   });

  return {
    dates: Array.from(salesMap.keys()),
    sales: Array.from(salesMap.values()).map(data => data.sales),
    orders: Array.from(salesMap.values()).map(data => data.orders)
  };
}

// functions for downloading reports excel
async function downloadExcel(orders, topProducts, topCategories, res) {
  const workbook = new ExcelJS.Workbook();
  const salesSheet = workbook.addWorksheet('Sales Report');

  salesSheet.columns = [
    { header: 'Order ID', key: 'orderId' },
    { header: 'Customer', key: 'customer' },
    { header: 'Date', key: 'date' },
    { header: 'Total', key: 'total' },
    { header: 'Discount', key: 'discount' },
    { header: 'Shipping Charge', key: 'shipping' }, 
    { header: 'Final Amount', key: 'final' }
  ];

  orders.forEach(order => {
    salesSheet.addRow({
        orderId: order.orderId,
        customer: order.userId?.name || 'Unknown',
        date: order.createdAt.toLocaleDateString(),
        total: order.items.reduce((sum, item) => sum + item.finalPrice, 0),
        discount: order.discount || 0,
        shipping: 50,
        final: order.items.reduce((sum, item) => sum + item.finalPrice, 0) - (order.discount || 0) + 50
    });
  });


  const productsSheet = workbook.addWorksheet('Top Products');
  productsSheet.columns = [
      { header: 'Product Name', key: 'name' },
      { header: 'Units Sold', key: 'unitsSold' },
      { header: 'Revenue', key: 'revenue' }
  ];
  topProducts.forEach(product => productsSheet.addRow(product));

  const categoriesSheet = workbook.addWorksheet('Top Categories');
    categoriesSheet.columns = [
        { header: 'Category', key: 'name' },
        { header: 'Sales', key: 'sales' },
        { header: 'Percentage', key: 'percentage' }
    ];
    topCategories.forEach(category => categoriesSheet.addRow(category));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

    await workbook.xlsx.write(res);
}

//function for downloading pdf
async function downloadPDF(orders, topProducts, topCategories, res) {
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
  doc.pipe(res);

  doc.fontSize(18).text('Sales Report', { align: 'center' });
  doc.moveDown();

  doc.fontSize(14).text('Order Details', { align: 'left' });
  doc.moveDown();
  
  const orderTableTop = doc.y;
  const orderTableLeft = 50;
  const colWidths = [70, 80, 70, 70, 70, 80, 80]; 
  const colLabels = ['Order ID', 'Customer', 'Date', 'Total', 'Discount', 'Shipping', 'Final Amount'];
  const rowHeight = 25;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  
  doc.font('Helvetica-Bold');
  doc.fontSize(10);
  
  doc.rect(orderTableLeft, orderTableTop, tableWidth, rowHeight).stroke();
  
  let xPos = orderTableLeft;
  for (let i = 0; i < colWidths.length - 1; i++) {
    xPos += colWidths[i];
    doc.moveTo(xPos, orderTableTop)
       .lineTo(xPos, orderTableTop + rowHeight)
       .stroke();
  }
  
  xPos = orderTableLeft;
  for (let i = 0; i < colLabels.length; i++) {
    doc.text(colLabels[i], xPos + 5, orderTableTop + 7, { width: colWidths[i] - 10, align: 'center' });
    xPos += colWidths[i];
  }
  
  doc.font('Helvetica');
  let yPos = orderTableTop + rowHeight;
  
  const checkPage = (height) => {
    if (yPos + height > doc.page.height - 50) {
      doc.addPage();
      yPos = 50;
      
      doc.fontSize(14).text('Order Details (continued)', { align: 'left' });
      doc.moveDown();
      yPos = doc.y;
      
      doc.font('Helvetica-Bold');
      doc.rect(orderTableLeft, yPos, tableWidth, rowHeight).stroke();
      
      let xHeaderPos = orderTableLeft;
      for (let i = 0; i < colWidths.length - 1; i++) {
        xHeaderPos += colWidths[i];
        doc.moveTo(xHeaderPos, yPos)
           .lineTo(xHeaderPos, yPos + rowHeight)
           .stroke();
      }
      
      xHeaderPos = orderTableLeft;
      for (let i = 0; i < colLabels.length; i++) {
        doc.text(colLabels[i], xHeaderPos + 5, yPos + 7, { width: colWidths[i] - 10, align: 'center' });
        xHeaderPos += colWidths[i];
      }
      
      doc.font('Helvetica');
      yPos += rowHeight;
    }
  };

  orders.forEach(order => {
    checkPage(rowHeight);
    
    const total = order.items.reduce((sum, item) => sum + item.finalPrice, 0);
    const discount = order.discount || 0;
    const shipping = 50;
    const final = total - discount + shipping;
    
    doc.rect(orderTableLeft, yPos, tableWidth, rowHeight).stroke();
    
    xPos = orderTableLeft;
    for (let i = 0; i < colWidths.length - 1; i++) {
      xPos += colWidths[i];
      doc.moveTo(xPos, yPos)
         .lineTo(xPos, yPos + rowHeight)
         .stroke();
    }
    
    xPos = orderTableLeft;
    const rowData = [
      order.orderId, 
      order.userId?.name || 'Unknown', 
      order.createdAt.toLocaleDateString(),
      `Rs${total.toFixed(2)}`,
      `Rs${discount.toFixed(2)}`,
      `Rs${shipping.toFixed(2)}`,
      `Rs${final.toFixed(2)}`
    ];
    
    for (let i = 0; i < rowData.length; i++) {
      doc.text(rowData[i], xPos + 5, yPos + 7, { width: colWidths[i] - 10, align: 'center' });
      xPos += colWidths[i];
    }
    
    yPos += rowHeight;
  });
  
  doc.addPage();
  doc.fontSize(14).text('Top Products', { align: 'center' });
  doc.moveDown();
  
  const productTableTop = doc.y;
  const productTableLeft = 100;
  const productColWidths = [200, 100, 100];
  const productTableWidth = productColWidths.reduce((a, b) => a + b, 0);
  const productLabels = ['Product Name', 'Units Sold', 'Revenue'];
  
  doc.font('Helvetica-Bold');
  
  doc.rect(productTableLeft, productTableTop, productTableWidth, rowHeight).stroke();
  
  xPos = productTableLeft;
  for (let i = 0; i < productColWidths.length - 1; i++) {
    xPos += productColWidths[i];
    doc.moveTo(xPos, productTableTop)
       .lineTo(xPos, productTableTop + rowHeight)
       .stroke();
  }
  
  xPos = productTableLeft;
  for (let i = 0; i < productLabels.length; i++) {
    doc.text(productLabels[i], xPos + 5, productTableTop + 7, { width: productColWidths[i] - 10, align: 'center' });
    xPos += productColWidths[i];
  }
  
  doc.font('Helvetica');
  yPos = productTableTop + rowHeight;
  
  topProducts.forEach(product => {
    if (yPos + rowHeight > doc.page.height - 50) {
      doc.addPage();
      doc.fontSize(14).text('Top Products (continued)', { align: 'center' });
      doc.moveDown();
      yPos = doc.y;
      
      doc.font('Helvetica-Bold');
      doc.rect(productTableLeft, yPos, productTableWidth, rowHeight).stroke();
      
      let xHeaderPos = productTableLeft;
      for (let i = 0; i < productColWidths.length - 1; i++) {
        xHeaderPos += productColWidths[i];
        doc.moveTo(xHeaderPos, yPos)
           .lineTo(xHeaderPos, yPos + rowHeight)
           .stroke();
      }
      
      xHeaderPos = productTableLeft;
      for (let i = 0; i < productLabels.length; i++) {
        doc.text(productLabels[i], xHeaderPos + 5, yPos + 7, { width: productColWidths[i] - 10, align: 'center' });
        xHeaderPos += productColWidths[i];
      }
      
      doc.font('Helvetica');
      yPos += rowHeight;
    }
    
    doc.rect(productTableLeft, yPos, productTableWidth, rowHeight).stroke();

    xPos = productTableLeft;
    for (let i = 0; i < productColWidths.length - 1; i++) {
      xPos += productColWidths[i];
      doc.moveTo(xPos, yPos)
         .lineTo(xPos, yPos + rowHeight)
         .stroke();
    }
    
    xPos = productTableLeft;
    const rowData = [
      product.name,
      product.unitsSold.toString(),
      `Rs${product.revenue.toFixed(2)}`
    ];
    
    for (let i = 0; i < rowData.length; i++) {
      doc.text(rowData[i], xPos + 5, yPos + 7, { width: productColWidths[i] - 10, align: 'center' });
      xPos += productColWidths[i];
    }
    
    yPos += rowHeight;
  });
  
  doc.addPage();
  doc.fontSize(14).text('Top Categories', { align: 'center' });
  doc.moveDown();
  
  const categoryTableTop = doc.y;
  const categoryTableLeft = 100;
  const categoryColWidths = [200, 100, 100];
  const categoryTableWidth = categoryColWidths.reduce((a, b) => a + b, 0);
  const categoryLabels = ['Category', 'Sales', 'Percentage'];
  
  doc.font('Helvetica-Bold');
  
  doc.rect(categoryTableLeft, categoryTableTop, categoryTableWidth, rowHeight).stroke();
  
  xPos = categoryTableLeft;
  for (let i = 0; i < categoryColWidths.length - 1; i++) {
    xPos += categoryColWidths[i];
    doc.moveTo(xPos, categoryTableTop)
       .lineTo(xPos, categoryTableTop + rowHeight)
       .stroke();
  }
  
  xPos = categoryTableLeft;
  for (let i = 0; i < categoryLabels.length; i++) {
    doc.text(categoryLabels[i], xPos + 5, categoryTableTop + 7, { width: categoryColWidths[i] - 10, align: 'center' });
    xPos += categoryColWidths[i];
  }
  
  doc.font('Helvetica');
  yPos = categoryTableTop + rowHeight;
  
  topCategories.forEach(category => {
    if (yPos + rowHeight > doc.page.height - 50) {
      doc.addPage();
      doc.fontSize(14).text('Top Categories (continued)', { align: 'center' });
      doc.moveDown();
      yPos = doc.y;
      
      doc.font('Helvetica-Bold');
      doc.rect(categoryTableLeft, yPos, categoryTableWidth, rowHeight).stroke();
    
      let xHeaderPos = categoryTableLeft;
      for (let i = 0; i < categoryColWidths.length - 1; i++) {
        xHeaderPos += categoryColWidths[i];
        doc.moveTo(xHeaderPos, yPos)
           .lineTo(xHeaderPos, yPos + rowHeight)
           .stroke();
      }
      
      xHeaderPos = categoryTableLeft;
      for (let i = 0; i < categoryLabels.length; i++) {
        doc.text(categoryLabels[i], xHeaderPos + 5, yPos + 7, { width: categoryColWidths[i] - 10, align: 'center' });
        xHeaderPos += categoryColWidths[i];
      }
      
      doc.font('Helvetica');
      yPos += rowHeight;
    }
    
    doc.rect(categoryTableLeft, yPos, categoryTableWidth, rowHeight).stroke();
    
    xPos = categoryTableLeft;
    for (let i = 0; i < categoryColWidths.length - 1; i++) {
      xPos += categoryColWidths[i];
      doc.moveTo(xPos, yPos)
         .lineTo(xPos, yPos + rowHeight)
         .stroke();
    }
    
    xPos = categoryTableLeft;
    const rowData = [
      category.name,
      `Rs${category.sales.toFixed(2)}`,
      `${category.percentage}%`
    ];
    
    for (let i = 0; i < rowData.length; i++) {
      doc.text(rowData[i], xPos + 5, yPos + 7, { width: categoryColWidths[i] - 10, align: 'center' });
      xPos += categoryColWidths[i];
    }
    
    yPos += rowHeight;
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