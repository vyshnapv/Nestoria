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
        
        if (userData && userData.is_blocked) {
            req.session.destroy();
            return res.redirect("/login");
        }
        
        if (!userData) {
            return res.redirect("/login");
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // Orders per page
        const skip = (page - 1) * limit;

        // Get total count of orders
        const totalOrders = await Order.countDocuments({ userId: userData._id });
        const totalPages = Math.ceil(totalOrders / limit);

        // Get paginated orders
        const orders = await Order.find({ userId: userData._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const formattedOrders = orders.map(order => {
            let totalPrice = order.items.reduce((sum, price) => sum += price.finalPrice, 0);
            return {
                orderId: order.orderId,
                date: new Date(order.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }),
                totalPrice: totalPrice.toFixed(2),
                paymentStatus: order.paymentStatus,
                orderStatus: order.orderStatus,
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

        res.render("viewOrders", {
            userData,
            orders: formattedOrders,
            paginatedOrders: formattedOrders,
            currentPage: page,
            totalPages: totalPages,
            helpers: {
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


//get order details
const getOrderDetails = async (req, res) => {
    try {
        const userData = req.session.user ? await User.findById(req.session.user) : null;
        
        if (userData && userData.is_blocked) {
            req.session.destroy();
            return res.redirect("/login");
        }

        const { orderId } = req.params;
        
        const order = await Order.findOne({ orderId }).populate({
            path: 'items.productId',
            model: 'Product',
            populate: {
                path: 'category',
                model: 'Category',
                select: 'name'
              },
            select: 'productName category productImage'
        });

        if (!order) {
            return res.status(404).render('error', {
                message: 'Order not found',
                error: { status: 404 }
            });
        }

        const activeTotalPrice = order.items.reduce((total, item) => {
            return item.itemStatus !== 'Cancelled' ? total + item.finalPrice : total;
        }, 0);

        const formattedOrder = {
            orderId: order.orderId,
            orderDate: new Date(order.createdAt).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            address: order.address,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            orderStatus: order.orderStatus,
            totalPrice: activeTotalPrice.toFixed(2),
            items: order.items.map(item => ({
                productName: item.productName,
                category: item.productId.category,
                image: item.productId.productImage[0], 
                quantity: item.quantity,
                price: item.price.toFixed(2),
                finalPrice: item.finalPrice.toFixed(2),
                itemStatus: item.itemStatus
            }))
        };

        res.render("orderDetails", {
            userData,
            order: formattedOrder
        });

    } catch (error) {
        console.error('Error in getOrderDetails:', error);
        res.status(500).render('error', {
            message: 'An error occurred while fetching order details',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};


//cancelled order
const cancelOrderItem = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { productName, reason } = req.body;
        
        const order = await Order.findOne({ orderId });
        
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }
        
        const itemIndex = order.items.findIndex(item => item.productName === productName);
        
        if (itemIndex === -1) {
            return res.status(404).json({ 
                success: false,
                message: 'Product not found in order' 
            });
        }
        
        const item = order.items[itemIndex];
        
        if (item.itemStatus !== 'Ordered') {
            return res.status(400).json({ 
                success: false, 
                message: 'This item cannot be cancelled in its current status' 
            });
        }
        
        item.itemStatus = 'Cancelled';
        item.reason = reason;
        
        const product = await Product.findById(item.productId);
        
        if (product) {
            product.quantity += item.quantity;
            await product.save();
        }

        order.totalPrice = order.items.reduce((total, currentItem) => {
            return currentItem.itemStatus !== 'Cancelled' ? total + currentItem.finalPrice : total;
        }, 0);
    
        
        const allItemsCancelled = order.items.every(item => item.itemStatus === 'Cancelled');
        if (allItemsCancelled) {
            order.orderStatus = 'Cancelled';
        }
        
        await order.save();
        
        res.status(200).json({ 
            success: true, 
            message: 'Order item cancelled successfully' ,
            updatedTotalPrice: order.totalPrice
        });
        
    } catch (error) {
        console.error('Error in cancelOrderItem:', error);
        res.status(500).json({ 
            success: false, 
            message: 'An error occurred while cancelling the order item' 
        });
    }
};



module.exports={
    createOrder,
    orderSuccess,
    getViewOrders,
    getOrderDetails,
    cancelOrderItem,
}
