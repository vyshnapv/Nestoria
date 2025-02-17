const Product = require("../../models/productModel");
const Offer = require("../../models/offerModel");
const Category = require("../../models/categoryModel");
const Coupon = require("../../models/couponModel")


const couponManagement = async(req,res)=>{
    try {
        const page=parseInt(req.query.page)||1;
        const limit=5;
        const skip=(page-1)*limit;

        const searchQuery = req.query.search || '';

        const filter = searchQuery ? {
            $or: [
                { title: { $regex: searchQuery, $options: 'i' } },
                { couponCode: { $regex: searchQuery, $options: 'i' } }
            ]
        } : {};

        const totalCoupons = await Coupon.countDocuments(filter);
        const totalPages = Math.ceil(totalCoupons / limit);

        const coupons = await Coupon.find(filter)
             .sort({createAt:-1})
             .skip(skip)
             .limit(limit);

        res.render("couponManagement",{
            coupons,
            currentPage:page,
            totalPages,
            totalCoupons,
            searchQuery
        })
    } catch (error) {
        console.error("Error in offer management:", error);
        res.redirect("/pageerror"); 
    }
}

const createCoupon=async(req,res)=>{
    try {
        const {title,code,description,validFrom,expiryDate,discountPercentage,minPurchase,maxDiscount}=req.body;

        const newCoupon=new Coupon({
            title,
            couponCode:code,
            description,
            percentage:discountPercentage,
            minPrice:minPurchase,
            maxRedeemAmount:maxDiscount,
            addedDate:new Date(validFrom),
            expiryDate:new Date(expiryDate),
            status:"Active"
        });

        await newCoupon.save();
        res.status(201).json({message:"coupon created successfully",coupon:newCoupon})
    } catch (error) {
         console.error("Error creating coupon:", error);
        res.status(500).json({ message: "Failed to create coupon", error: error.message });
    }
}

//updateCoupon
const updateCoupon=async(req,res)=>{
    try {
        const { id } = req.params;
        const { title, code, description, validFrom, expiryDate, discountPercentage, minPurchase, maxDiscount } = req.body;

        const coupon = await Coupon.findByIdAndUpdate(id, {
            title,
            couponCode: code,
            description,
            percentage: discountPercentage,
            minPrice: minPurchase,
            maxRedeemAmount: maxDiscount,
            addedDate: new Date(validFrom),
            expiryDate: new Date(expiryDate)
        }, { new: true });

        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }

        res.status(200).json({ message: "Coupon updated successfully", coupon });
    } catch (error) {
        console.error("Error updating coupon:", error);
        res.status(500).json({ message: "Failed to update coupon", error: error.message });
    }
}

//toggle status 
const toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }

        coupon.status = coupon.status === 'Active' ? 'Inactive' : 'Active';
        await coupon.save();

        res.status(200).json({ 
            message: "Coupon status updated", 
            coupon: { 
                status: coupon.status,
                _id: coupon._id 
            }
        });
    } catch (error) {
        console.error("Error toggling coupon status:", error);
        res.status(500).json({ message: "Failed to update coupon status", error: error.message });
    }
};

//delete coupon 
const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findByIdAndDelete(id);

        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }

        res.status(200).json({ message: "Coupon deleted successfully" });
    } catch (error) {
        console.error("Error deleting coupon:", error);
        res.status(500).json({ message: "Failed to delete coupon", error: error.message });
    }
};

const getCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }

        res.status(200).json(coupon);
    } catch (error) {
        console.error("Error fetching coupon:", error);
        res.status(500).json({ message: "Failed to fetch coupon", error: error.message });
    }
};

module.exports={
    couponManagement,
    createCoupon,
    updateCoupon,
    toggleCouponStatus,
    deleteCoupon,
    getCoupon
}