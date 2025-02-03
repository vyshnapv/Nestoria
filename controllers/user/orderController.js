const mongoose = require('mongoose');
const User = require("../../models/userModel");
const Address = require("../../models/addressModel");
const Cart = require("../../models/cartModel");
const Order = require("../../models/orderModel");
const Product = require("../../models/productModel");
const Offer=require("../../models/offerModel")
const Category = require("../../models/categoryModel");
const Coupon=require("../../models/couponModel")
const Wallet=require("../../models/walletModel")
const {addToWallet}=require("../../controllers/user/walletController")

const Razorpay = require('razorpay');
const crypto = require('crypto');


const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


const createOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { paymentMethod, addressId } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to place an order." });
        }

        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.product',
            populate: {
                path: 'category',
                model: 'Category'
            }
        });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Your cart is empty." });
        }

        for (const item of cart.items) {
            const product = await Product.findById(item.product._id);
            if (product.quantity < item.quantity) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Insufficient stock for ${product.productName}. Only ${product.quantity} available.` 
                });
            }
        }

        const address = await Address.findOne({ userId });
        if (!address || !address.address[addressId]) {
            return res.status(404).json({ success: false, message: "Address not found." });
        }

        const selectedAddress = address.address[addressId];

        const orderItems = [];
        let subtotal = 0;
        
        for (const item of cart.items) {
            const product = await Product.findById(item.product._id);
            const originalPrice = product.regularPrice;
            
            const currentDate = new Date();
            const offers = await Offer.find({
                status: 'Active',
                expireDate: { $gt: currentDate }
            });
            
            const productOffer = offers.find(offer => 
                (offer.productIds?.includes(product._id)) ||
                (offer.categoryIds?.includes(product.category))
            );

            const priceAfterOffer = productOffer 
                ? originalPrice * (1 - productOffer.discount / 100)
                : originalPrice;
            
            const itemSubtotal = priceAfterOffer * item.quantity;
            subtotal += itemSubtotal;

            orderItems.push({
                productId: product._id,
                productName: product.productName,
                quantity: item.quantity,
                price: originalPrice,
                finalPrice: itemSubtotal,
                itemStatus: "Ordered",
                highestDiscount: productOffer ? productOffer.discount : 0
            });
        }

        let finalAmount = subtotal;
        const appliedCoupon = req.session.appliedCoupon;
        
        if (appliedCoupon) {
            const discountAmount = appliedCoupon.discountAmount;
            finalAmount = subtotal - discountAmount;

            orderItems.forEach(item => {
                const proportion = item.finalPrice / subtotal;
                const itemDiscount = discountAmount * proportion;
                item.finalPrice -= itemDiscount;
            });
        }

        switch (paymentMethod) {
            case 'COD': {
                const newOrder = new Order({
                    orderId: `ORD-${Date.now()}`,
                    userId,
                    items: orderItems,
                    totalPrice: finalAmount,
                    address: {
                        name: selectedAddress.name,
                        phone: selectedAddress.phone,
                        district: selectedAddress.district,
                        city: selectedAddress.city,
                        house: selectedAddress.house,
                        state: selectedAddress.state,
                        pincode: selectedAddress.pincode,
                    },
                    paymentMethod,
                    paymentStatus: 'Pending',
                    orderStatus: "Processing"
                });

                await newOrder.save();

                for (const item of orderItems) {
                    await Product.findByIdAndUpdate(
                        item.productId,
                        { $inc: { quantity: -item.quantity } }
                    );
                }

                await Cart.deleteOne({ userId });
                delete req.session.appliedCoupon;

                return res.status(200).json({ 
                    success: true, 
                    orderId: newOrder.orderId 
                });
            }

            case 'Wallet': {
                const wallet = await Wallet.findOne({ userId });
                
                if (!wallet || wallet.balance < finalAmount) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Insufficient wallet balance' 
                    });
                }

                const newOrder = new Order({
                    orderId: `ORD-${Date.now()}`,
                    userId,
                    items: orderItems,
                    totalPrice: finalAmount,
                    address: {
                        name: selectedAddress.name,
                        phone: selectedAddress.phone,
                        district: selectedAddress.district,
                        city: selectedAddress.city,
                        house: selectedAddress.house,
                        state: selectedAddress.state,
                        pincode: selectedAddress.pincode,
                    },
                    paymentMethod,
                    paymentStatus: 'Paid',
                    orderStatus: "Processing"
                });

                await newOrder.save();

                for (const item of orderItems) {
                    await Product.findByIdAndUpdate(
                        item.productId,
                        { $inc: { quantity: -item.quantity } }
                    );
                }

                wallet.balance -= finalAmount;
                wallet.transactions.push({
                    amount: finalAmount,
                    type: 'debit',
                    description: `Payment for order ${newOrder.orderId}`,
                    balance: wallet.balance
                });
                await wallet.save();

                await Cart.deleteOne({ userId });
                delete req.session.appliedCoupon;

                return res.status(200).json({ 
                    success: true, 
                    orderId: newOrder.orderId 
                });
            }

            case 'Razorpay': {
                const razorpayOrderOptions = {
                    amount: Math.round(finalAmount * 100),
                    currency: 'INR',
                    receipt: `ORD-${Date.now()}`,
                    payment_capture: 1
                };

                const razorpayOrder = await razorpay.orders.create(razorpayOrderOptions);

                const newOrder = new Order({
                    orderId: `ORD-${Date.now()}`,
                    userId,
                    items: orderItems,
                    totalPrice: finalAmount,
                    address: {
                        name: selectedAddress.name,
                        phone: selectedAddress.phone,
                        district: selectedAddress.district,
                        city: selectedAddress.city,
                        house: selectedAddress.house,
                        state: selectedAddress.state,
                        pincode: selectedAddress.pincode,
                    },
                    paymentMethod,
                    paymentStatus: 'Pending',
                    orderStatus: "Processing",
                    razorpayOrderId: razorpayOrder.id
                });

                await newOrder.save();

                for (const item of orderItems) {
                    await Product.findByIdAndUpdate(
                        item.productId,
                        { $inc: { quantity: -item.quantity } }
                    );
                }

                await Cart.deleteOne({ userId });
                delete req.session.appliedCoupon;

                return res.status(200).json({ 
                    success: true, 
                    orderId: newOrder.orderId,
                    razorpayOrder: {
                        id: razorpayOrder.id,
                        key: process.env.RAZORPAY_KEY_ID,
                        amount: razorpayOrder.amount
                    }
                });
            }

            default:
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid payment method' 
                });
        }

    } catch (error) {
        console.error("Error placing order:", error);
        return res.status(500).json({ 
            success: false, 
            message: error.message || 'An error occurred while placing the order' 
        });
    }
};

//razorpay
const verifyRazorpayPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }
        const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
        
        if (!order) {
            console.error('Order not found for Razorpay order ID:', razorpay_order_id);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        order.paymentStatus = 'Paid';
        order.paymentMethod = 'Razorpay';
        order.razorpayPaymentId = razorpay_payment_id;
        
        await order.save();

        return res.status(200).json({ 
            success: true, 
            message: 'Payment verified successfully',
            orderId: order.orderId
        });

    } catch (error) {
        console.error('Razorpay verification error:', error);
        res.status(500).json({ success: false, message: 'Payment verification failed' });
    }
};

//ordersuccess
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
        const userData = await User.findById(req.session.user);
        if (!userData) {
            return res.redirect('/login');
        }
    
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const totalOrdersCount = await Order.countDocuments({ userId: userData._id });
        const totalPages = Math.ceil(totalOrdersCount / limit);

        const orders = await Order.find({ userId: userData._id })
            .populate({
                path: 'items.productId',
                populate: {
                    path: 'category',
                    model: 'Category'
                }
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        if (!orders || orders.length === 0) {
            return res.render("viewOrders", {
                userData,
                orders: [],
                paginatedOrders: [],
                currentPage: 1,
                totalPages: 1,
                helpers: {
                    getStatusClass: (status) => {
                        switch (status.toLowerCase()) {
                            case 'paid': return 'paid';
                            case 'pending': return 'pending';
                            case 'processing': return 'processing';
                            case 'shipped': return 'shipped';
                            case 'delivered': return 'delivered';
                            default: return '';
                        }
                    }
                }
            });
        }

        const formattedOrders = orders.map(order => {
            let subtotal = 0;
            let activeItemsCount = 0;
            
            const itemsWithOffers = order.items.map(item => {
                if (item.itemStatus !== 'Cancelled') {
                    activeItemsCount++;
                    subtotal += item.finalPrice;
                }
                
                return {
                    ...item,
                    originalPrice: item.price,
                    finalPrice: item.finalPrice
                };
            });

            let finalTotal = subtotal;
            if (order.appliedCoupon && activeItemsCount > 0) {
                const couponDiscount = (subtotal / order.totalPrice) * order.appliedCoupon.discountAmount;
                finalTotal = subtotal - couponDiscount;
            }

            return {
                orderId: order.orderId,
                date: new Date(order.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }),
                totalPrice: finalTotal.toFixed(2),
                originalTotal: order.totalPrice,
                paymentStatus: order.paymentStatus,
                orderStatus: order.orderStatus,
                items: itemsWithOffers,
                appliedCoupon: order.appliedCoupon
            };
        });

        res.render("viewOrders", {
            userData,
            orders: formattedOrders,
            paginatedOrders: formattedOrders,
            currentPage: page,
            totalPages,
            helpers: {
                getStatusClass: (status) => {
                    switch (status.toLowerCase()) {
                        case 'paid': return 'paid';
                        case 'pending': return 'pending';
                        case 'processing': return 'processing';
                        case 'shipped': return 'shipped';
                        case 'delivered': return 'delivered';
                        default: return '';
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error in getViewOrders:', error);

        res.render("viewOrders", {
            userData: req.session.user ? await User.findById(req.session.user) : null,
            orders: [],
            paginatedOrders: [],
            currentPage: 1,
            totalPages: 1,
            error: "An error occurred while fetching your orders. Please try again later.",
            helpers: {
                getStatusClass: (status) => {
                    switch (status.toLowerCase()) {
                        case 'paid': return 'paid';
                        case 'pending': return 'pending';
                        case 'processing': return 'processing';
                        case 'shipped': return 'shipped';
                        case 'delivered': return 'delivered';
                        default: return '';
                    }
                }
            }
        });
    }
};

//get order details
const getOrderDetails = async (req, res) => {
    try {
        const userData = await User.findById(req.session.user);
        const { orderId } = req.params;

        const order = await Order.findOne({ orderId }).populate({
            path: 'items.productId',
            model: 'Product',
            populate: {
                path: 'category',
                model: 'Category',
                select: 'name'
            }
        });

        if (!order) {
            return res.status(404).render('error', {
                message: 'Order not found',
                error: { status: 404 }
            });
        }

        let activeSubtotal = 0;
        let activeItemsCount = 0;

        const processedItems = order.items.map(item => {
            const itemData = {
                productName: item.productName,
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                highestDiscount: item.highestDiscount || 0,
                offerPrice: item.highestDiscount > 0 ? 
                    item.price * (1 - item.highestDiscount / 100) : 
                    item.price,
                finalPrice: item.finalPrice,
                itemStatus: item.itemStatus,
                returnStatus: item.returnStatus || 'Not Requested',
                returnReason: item.returnReason || '',
                category: item.productId.category
            };

            if (item.itemStatus !== 'Cancelled') {
                activeSubtotal += item.finalPrice;
                activeItemsCount++;
            }

            return itemData;
        });

        let finalTotal = activeSubtotal;
        if (order.appliedCoupon && activeItemsCount > 0) {
            const proportionalDiscount = (activeSubtotal / order.totalPrice) * order.appliedCoupon.discountAmount;
            finalTotal = activeSubtotal - proportionalDiscount;
        }

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
            items: processedItems.map(item => ({
                productName: item.productName,
                category: item.category,
                image: item.productId.productImage[0],
                quantity: item.quantity,
                price: item.price,
                offerPrice: item.offerPrice,
                highestDiscount: item.highestDiscount,
                finalPrice: item.finalPrice,
                itemStatus: item.itemStatus,
                returnStatus: item.returnStatus
            })),
            totalPrice: order.totalPrice,
            appliedCoupon: order.appliedCoupon ? {
                code: order.appliedCoupon.code,
                discountAmount: order.appliedCoupon.discountAmount
            } : null
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
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const itemIndex = order.items.findIndex(item => item.productName === productName);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in order' });
        }

        const item = order.items[itemIndex];
        if (item.itemStatus !== 'Ordered' && item.itemStatus !== 'Processing') {
            return res.status(400).json({ 
                success: false, 
                message: 'This item cannot be cancelled in its current status' 
            });
        }

        let refundAmount = item.finalPrice;
        if (order.appliedCoupon) {
            const proportionalDiscount = (item.finalPrice / order.totalPrice) * order.appliedCoupon.discountAmount;
            refundAmount = item.finalPrice - proportionalDiscount;
        }

        if ((order.paymentMethod === 'Razorpay' || order.paymentMethod === 'Wallet') && 
            order.paymentStatus === 'Paid') {
            let wallet = await Wallet.findOne({ userId: order.userId });
            
            if (!wallet) {
                wallet = new Wallet({
                    userId: order.userId,
                    balance: 0,
                    transactions: []
                });
            }

            const newBalance = wallet.balance + refundAmount;
            wallet.transactions.push({
                amount: refundAmount,
                type: 'credit',
                description: `Refund for cancelled item: ${item.productName}`,
                orderId: order._id,
                balance: newBalance
            });

            wallet.balance = newBalance;
            await wallet.save();
        }

        item.itemStatus = 'Cancelled';
        item.reason = reason;

        const product = await Product.findById(item.productId);
        if (product) {
            product.quantity += item.quantity;
            await product.save();
        }

        const activeItems = order.items.filter(item => item.itemStatus !== 'Cancelled');
        order.totalPrice = activeItems.reduce((total, item) => total + item.finalPrice, 0);

        if (activeItems.length === 0) {
            order.orderStatus = 'Cancelled';
        }

        await order.save();

        res.status(200).json({
            success: true,
            message: 'Order item cancelled successfully. Refund has been processed to your wallet.',
            updatedTotalPrice: order.totalPrice,
            refundAmount: refundAmount
        });

    } catch (error) {
        console.error('Error in cancelOrderItem:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while cancelling the order item'
        });
    }
};


//return order
const returnOrderItem = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { productName, reason } = req.body;

        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const itemToReturn = order.items.find(item => 
            item.productName === productName && item.itemStatus === 'Delivered'
        );

        if (!itemToReturn) {
            return res.status(400).json({
                success: false,
                message: 'Item cannot be returned'
            });
        }

        let refundAmount = itemToReturn.finalPrice;
        if (order.appliedCoupon) {
            const proportionalDiscount = (itemToReturn.finalPrice / order.totalPrice) * order.appliedCoupon.discountAmount;
            refundAmount = itemToReturn.finalPrice - proportionalDiscount;
        }

        if ((order.paymentMethod === 'Razorpay' || order.paymentMethod === 'Wallet') && 
            order.paymentStatus === 'Paid') {
            let wallet = await Wallet.findOne({ userId: order.userId });
            
            if (!wallet) {
                wallet = new Wallet({
                    userId: order.userId,
                    balance: 0,
                    transactions: []
                });
            }

            const newBalance = wallet.balance + refundAmount;
            wallet.transactions.push({
                amount: refundAmount,
                type: 'credit',
                description: `Refund for returned item: ${itemToReturn.productName}`,
                orderId: order._id,
                balance: newBalance
            });

            wallet.balance = newBalance;
            await wallet.save();
        }

        itemToReturn.returnReason = reason;
        itemToReturn.returnStatus = 'Return Requested';
        itemToReturn.returnRequestDate = new Date();
        itemToReturn.itemStatus = 'Return Processed';
        itemToReturn.refundAmount = refundAmount;

        await order.save();

        const product = await Product.findById(itemToReturn.productId);
        if (product) {
            product.quantity += itemToReturn.quantity;
            await product.save();
        }

        res.json({
            success: true,
            message: 'Return request processed successfully. Refund has been added to your wallet.',
            returnStatus: 'Return Processed',
            refundAmount: refundAmount.toFixed(2)
        });

    } catch (error) {
        console.error('Error in returnOrderItem:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while processing the return request'
        });
    }
};

module.exports={
    createOrder,
    verifyRazorpayPayment,
    orderSuccess,
    getViewOrders,
    getOrderDetails,
    cancelOrderItem,
    returnOrderItem,
}