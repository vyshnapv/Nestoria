const mongoose = require('mongoose');
const User = require("../../models/userModel");
const Address = require("../../models/addressModel");
const Cart = require("../../models/cartModel");
const Order = require("../../models/orderModel");
const Product = require("../../models/productModel");
const Category = require("../../models/categoryModel");


const createOrder = async (req, res) => {
    try {
        // console.log('req.body',req.body)
        const userId = req.session.user;
        const { paymentMethod, addressId } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to place an order." });
        }

        const cart = await Cart.findOne({ userId }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Your cart is empty." });
        }

        const address = await Address.findOne({ userId });
        if (!address) {
            return res.status(404).json({ success: false, message: "Address not found." });
        }
        const selectedAddress = address.address[addressId];


        const orderItems = cart.items.map((item) => ({
            productId: item.product._id,
            productName: item.product.productName,
            quantity: item.quantity,
            price: item.product.salePrice,
            finalPrice: item.product.salePrice * item.quantity,
            itemStatus: "Ordered",
          }));

        const totalPrice = orderItems.reduce((sum, item) => sum + item.finalPrice, 0);

        const newOrder = new Order({
            orderId: `ORD-${Date.now()}`,
            userId,
            items: orderItems,
            totalPrice,
            address:{
                name:selectedAddress.name,
                phone:selectedAddress.phone,
                district:selectedAddress.district,
                city:selectedAddress.city,
                house:selectedAddress.house,
                state:selectedAddress.state,
                pincode:selectedAddress.pincode,
            },
            paymentMethod,
            paymentStatus: paymentMethod === "COD" ? "Pending" : "Paid",
            orderStatus: "Processing",
          });

        await newOrder.save();
        await Cart.deleteOne({ userId });

        res.status(200).json({ success: true, message: "Order placed successfully!", orderId: newOrder.orderId, orderTime: newOrder.createdAt });

    }  catch (error) {
        console.error("Error placing order:", error);
        console.error("Error stack:", error.stack);
      
        if (error.name === 'ValidationError') {
          return res.status(400).json({ success: false, message: error.message });
        } else {
          return res.status(500).json({ success: false, message: 'An error occurred while placing the order' });
        }
      }
};

const orderSuccess = async (req,res)=>{
  try {

    const userData = req.session.user ? await User.findById(req.session.user) : null;
    
    const { orderId } = req.params;
    
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    order.orderStatus = 'Delivered';
    await order.save();

    const user = await User.findById(order.userId);

    if (!user.orderHistory) {
      user.orderHistory = [];
    }

    user.orderHistory.push(order._id);
    await user.save();


    res.render('orderPlaced', {
      userData,
      order,
      user,
    });

  } catch (error) {
    console.error('Error in orderSuccess:', error);
    res.status(500).json({ success: false, message: 'An error occurred while processing the order' });
    
  }
}


//get view order page 
const getViewOrders = async (req, res) => {
  try {
      const userData = req.session.user ? await User.findById(req.session.user) : null;
      
      // Check if the user is blocked, if so log out and redirect to login
      if (userData && userData.is_blocked) {
          req.session.destroy();
          return res.redirect("/login");
      }
      
      // If no user is logged in, redirect to login page
      if (!userData) {
          return res.redirect("/login");
      }

      // Fetch orders of the logged-in user
      const orders = await Order.find({ userId: userData._id })
          .sort({ createdAt: -1 }) // Sort orders by creation date (latest first)
          .lean();

      // Format the orders
      const formattedOrders = orders.map(order => {
          // Determine the order status based on the payment status
          const orderStatus = order.paymentStatus === 'Paid' ? 'Shipped' : (order.paymentStatus === 'Pending' ? 'Processing' : order.orderStatus);

          return {
              orderId: order.orderId,
              date: new Date(order.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit'
              }),
              totalPrice: order.totalPrice.toFixed(2),
              paymentStatus: order.paymentStatus,
              orderStatus: orderStatus, // Set dynamic order status based on payment status
              items: order.items.map(item => ({
                  productName: item.productName,
                  quantity: item.quantity,
                  price: item.price,
                  finalPrice: item.finalPrice,
                  itemStatus: item.itemStatus
              })),
              address: order.address,
              paymentMethod: order.paymentMethod
          };
      });

      // Render the viewOrders page, passing in the formatted orders
      res.render("viewOrders", {
          userData,
          orders: formattedOrders,
          helpers: {
              // Helper function to determine status class for styling
              getStatusClass: (status) => {
                  switch (status.toLowerCase()) {
                      case 'paid':
                          return 'paid';
                      case 'pending':
                          return 'pending';
                      case 'processing':
                          return 'processing';
                      case 'shipped':
                          return 'shipped';
                      case 'delivered':
                          return 'delivered';
                      default:
                          return '';
                  }
              }
          }
      });

  } catch (error) {
      console.error('Error in getViewOrders:', error);
      res.status(500).render('error', {
          message: 'An error occurred while fetching your orders',
          error: process.env.NODE_ENV === 'development' ? error : {}
      });
  }
};


module.exports={
    createOrder,
    orderSuccess,
    getViewOrders
}
