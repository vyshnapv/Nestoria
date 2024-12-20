
const Admin = require("../../models/adminModel");
const Order = require('../../models/orderModel');
const User = require('../../models/userModel');
const Product = require("../../models/productModel");

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
const loadDashboard=async(req,res)=>
{
    if(req.session.admin)
   {
    try {
        res.render("dashboard")
    } catch (error) {
        res.redirect("/pageerror")
    }
   }
}


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

        const hasReturnRequest = order.items.some(item => 
          item.returnStatus && 
          ['Return Requested', 'Return Accepted'].includes(item.returnStatus)
        );
        return {
          _id: order._id,
          orderId: order.orderId,
          orderDate: new Date(order.createdAt).toLocaleDateString('en-GB'),
          customerName: customerName || "Unknown Customer",
          totalPrice: order.totalPrice.toFixed(2),
          paymentMethod: order.paymentMethod,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          hasReturnRequest: hasReturnRequest,
          returnItems: order.items.filter(item =>
            item.returnStatus && 
            ['Return Requested', 'Return Accepted'].includes(item.returnStatus)
          ).map(item => ({
            ...item,
            // Add a display status for more user-friendly representation
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
    res.render('orders', { orders: formattedOrders , pagination, search:searchTerm });
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
    // Update overall order status
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

    const formattedOrder = {
      orderId: order.orderId,
      orderDate: new Date(order.createdAt).toLocaleDateString('en-GB'),
      totalAmount: order.totalPrice.toFixed(2),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      customer: {
        name: customer?.name || 'Unknown Customer',
        email: customer?.email || 'N/A',
        phone: customer?.phone || 'N/A'
      },
      address: order.address,
      items: order.items.map(item => {
        return {
          productId: item.productId?._id || '',
          productName: item.productId?.productName || 'Product Unavailable',
          category: item.productId?.category?.name || 'Uncategorized',
          image: item.productId?.productImage?.[0] 
            ? `/uploads/cropped/${item.productId.productImage[0]}` 
            : '/placeholder-image.jpg',
          quantity: item.quantity,
          price: item.price.toFixed(2),
          finalPrice: item.finalPrice.toFixed(2),
          status: item.itemStatus,
          isAvailable: !item.productId?.isBlocked
        };
      })
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
      
      if (allItemStatuses.every(itemStatus => itemStatus === 'Delivered')) {
          order.orderStatus = 'Delivered';
      } else if (allItemStatuses.every(itemStatus => itemStatus === 'Cancelled')) {
          order.orderStatus = 'Cancelled';
      } else if (allItemStatuses.every(itemStatus => itemStatus === 'Shipped')) {
          order.orderStatus = 'Shipped';
      } else if (allItemStatuses.some(itemStatus => itemStatus === 'Processing')) {
          order.orderStatus = 'Processing';
      }

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



module.exports={
    loadLogin,
    login,
    logoutAdmin,
    loadDashboard,
    pageerror,
    loadOrdersList,
    updateReturnStatus,
    adminOrderDetails,
    updateOrderStatus
}