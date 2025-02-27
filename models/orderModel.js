const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User"
    },
    totalPrice: {
        type: Number,
        required: true,
    },
    items: [
        {
            productId: {
                type: Schema.Types.ObjectId,
                required: true,
                ref: "Product"
            },
            productName: {
                type: String,
                required: true
            },
            quantity: {
                type: Number,
                required: true
            },
            itemStatus: {
                type: String,
                required: true,
                default: "Ordered"
            },
            price: {
                type: Number,
                required: true
            },
            highestDiscount: {
                type: Number,
                default: 0
            },
            couponDiscount: {
                type: Number,
                default: 0
            },
            couponCode: {
                type: String,
                default: null
            },
            offerPrice: {
                type: Number,
            },
            finalPrice: {
                type: Number,
                required: true
            },
            reason: {
                type: String,
            },
            isApproved: {
                type: Boolean,
            },
            returnReason: { type: String },
            returnStatus: { 
             type: String, 
             enum: ['Not Requested', 'Return Requested', 'Return Accepted', 'Return Rejected'],
             default: 'Not Requested'
           },
           returnReason: { type: String },
           returnRequestDate: { type: Date },
           isApproved: { type: Boolean }
        },
    ],
    address: {
        name: {
            type: String
        },
        phone: {
            type: String
        },
        district: {
            type: String
        },
        city: {
            type: String
        },
        house: {
            type: String
        },
        state: {
            type: String
        },
        pincode: {
            type: String
        },
    },
    paymentMethod: {
        type: String,
        enum:['COD','Razorpay','Wallet'],
        required: true,
    },
    paymentStatus: {
        type: String,
        enum:['Paid','Pending','Failed','Refunded'],
        required: true
    },
    orderStatus: {
        type: String,
        required: true,
        enum:['Processing','Shipped','Delivered','Cancelled','Return Request','Returned','pending'],
        default: "Processing"
    },
    razorpayOrderId: {
        type: String,
        required: function() {
            return this.paymentMethod === 'Razorpay';
        }
    },
    deliveryCharge: {
        type: Number,
        default: 50
    }
},{timestamps:true});

module.exports = mongoose.model("Order", OrderSchema);