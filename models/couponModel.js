const mongoose = require('mongoose');

const couponSchema = mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    couponCode: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String
    },
    percentage: {
        type: Number,
        required: true,
        min: 1,
        max: 80
    },
    minPrice: {
        type: Number,
        default: 0
    },
    maxRedeemAmount: {
        type: Number,
    },
    expiryDate: {
        type: Date,
        required: true,
        index: {expires: 0}
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    addedDate: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Coupon",couponSchema);