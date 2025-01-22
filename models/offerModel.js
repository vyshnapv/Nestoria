const mongoose = require("mongoose");
const { Schema } = mongoose;

const offerSchema = new Schema(
    {
        productName: {
            type: String,
            required: function() {
                return this.offerType === "Product";
            }
        },
        categoryName: {
            type: String,
            required: function() {
                return this.offerType === "Category";
            }
        },
        offerType: {
            type: String,
            enum: ["Product", "Category"],
            required: true,
        },
        offerName: {
            type: String,
            required: true,
        },
        discount: {
            type: Number,
            required: true,
        },
        expireDate: {
            type: Date,
            required: true,
        },
        productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: function () {
                return this.offerType === "Product";
            },
        },
        categoryId: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: function () {
                return this.offerType === "Category";
            },
        },
        referralCode: {
            type: String,
            required: false,
        },
        status: {
            type: String,
            enum: ["Active", "Expired", "Pending"],
            default: "Pending",
        },
        isBlocked: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

const Offer = mongoose.model("Offer",offerSchema);
module.exports = Offer;

