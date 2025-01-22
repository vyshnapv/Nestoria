const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new Schema({
    productName: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
    },
    regularPrice: {
        type: Number,
        required: true,
    },
    quantity: {
        type: Number,
        default: 0,  
    },
    color: {
        type: String,
    },
    productImage: {
        type: [String],
    },
    isBlocked: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        enum: ['Available', 'Out of Stock'],
        default: 'Available',
    },
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
