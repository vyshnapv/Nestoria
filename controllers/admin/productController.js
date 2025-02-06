const Product = require("../../models/productModel");
const User = require("../../models/userModel");
const Category = require("../../models/categoryModel");
const fs=require("fs")
const path=require("path")
const sharp=require("sharp")



const getProductAddPage=async(req,res)=>{
    try {
        const category=await Category.find({isListed:true})
        res.render("productadd",{
            category,
        })
    } catch (error) {
       
        res.redirect("/pageerror")
    }
}

const addProducts = async (req, res) => {
    try {
        const products = req.body;

        const productExists = await Product.findOne({
            productName: products.productName,
        });
            
        if (!productExists) {
            const images = [];
            if (req.files && req.files.length > 0) {
                const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
                const croppedDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'cropped');
                
                if (!fs.existsSync(uploadsDir)) {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                }
                if (!fs.existsSync(croppedDir)) {
                    fs.mkdirSync(croppedDir, { recursive: true });
                }

                for (const file of req.files) {
                    try {
                        
                        const originalImagePath = path.join(uploadsDir, file.filename);
                        const resizedImagePath = path.join(croppedDir, file.filename);
                        
                        if (!fs.existsSync(originalImagePath)) {
                            console.error('Original image not found:', originalImagePath);
                            continue;
                        }

                        await sharp(file.path)
                            .resize(440, 440, {
                                fit: 'cover',
                                position: 'center'
                            })
                            .toFile(resizedImagePath);

                        images.push(file.filename);
                        
                        fs.unlink(file.path, (err) => {
                            if (err) console.error('Error deleting original file:', err);
                        });
                    } catch (err) {
                        console.error('Error processing image:', err);
                        continue;
                    }
                }
            }

            const categoryId = await Category.findOne({_id: products.category});
            
            if (!categoryId) {
                return res.status(400).json({ message: "Invalid category name" });
            }

            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                category: categoryId._id,
                regularPrice: products.regularPrice,
                createdOn: new Date(),
                quantity: products.quantity,
                productImage: images,
                status: 'Available',
            });

            await newProduct.save();
            return res.redirect("/admin/Products");
        } else {
            return res.status(400).json({ message: "Product already exists, please try with another name" });
        }
    } catch (error) {
        console.error("Error saving product:", error);
        return res.redirect("/admin/pageerror");
    }
};

//product list page
const getAllProducts=async(req,res)=>{
    try {
        const search=req.query.search || "";
        const page=parseInt(req.query.page) || 1;
        const limit=4;
        const skip=(page-1)*limit

        const productData=await Product.find({
            
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
            ],
        }).skip(skip).limit(limit).populate("category").exec()


        const count=await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
            ],
        }).countDocuments();

        const category=await Category.find({isListed:true});

        if(category)
        {
            res.render("products",{
                data:productData,
                currentPage:page,
                totalPages:Math.ceil(count/limit),
                cat:category,
                search: search,
            })
        }
        else{
            res.render("page-404");
        }
    } catch (error) {
        console.error(error);
        res.redirect("/pageerror")
    }
}


//block properties
const blockProduct=async(req,res)=>{
    try {
        let id=req.query.id;
        const result = await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
        
        if (!result) {
           
            return res.json({ message: "Product not found or already blocked." });
        }
        res.json({ message: "Product blocked successfully" });
    } catch (error) {
        console.error(error); 
        res.json({ message: "Failed to block the product" });
    }
}

//unblock category
const unblockProduct = async (req, res) => {
    try {
        let id=req.query.id;
        const result = await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
        
        if (!result) {
           
            return res.json({ message: "Product not found or already unblocked." });
        }
        res.json({ message: "Product unblocked successfully" });
    } catch (error) {
        console.error(error);
        res.json({ message: "Failed to unblock the product" });
    }
}

//edit product
const getEditProduct=async(req,res)=>{
    try {
        const id=req.query.id;
        const product=await Product.findOne({_id:id});
        const category=await Category.find({})

        res.render("editproduct",{
            product:product,
            cat:category,
        })
        
    } catch (error) {
      console.error('Error in getEditProduct:', error);
        res.redirect("/pageerror");
    }
}

//edit product
const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findById(id);
        const data = req.body;

        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        });

        if (existingProduct) {
            return res.status(400).json({ error: "Product name already exists" });
        }

        const deletedImages = JSON.parse(data.deletedImages || '[]');
        let currentImages = product.productImage.filter(img => !deletedImages.includes(img));

        for (const filename of deletedImages) {
            const imagePath = path.join(__dirname, '..', '..', 'public', 'uploads', 'cropped', filename);
            try {
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            } catch (err) {
                console.error('Error deleting image file:', err);
            }
        }

        if (req.files && req.files.length > 0) {
            const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
            const croppedDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'cropped');
            
            fs.mkdirSync(uploadsDir, { recursive: true });
            fs.mkdirSync(croppedDir, { recursive: true });

            for (const file of req.files) {
                try {
                    const resizedImagePath = path.join(croppedDir, file.filename);
                    
                    await sharp(file.path)
                        .resize(440, 440, {
                            fit: 'cover',
                            position: 'center'
                        })
                        .toFile(resizedImagePath);

                    currentImages.push(file.filename);
                    
                    fs.unlinkSync(file.path);
                } catch (err) {
                    console.error('Error processing new image:', err);
                }
            }
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            {
                productName: data.productName,
                description: data.description,
                regularPrice: data.regularPrice,
                quantity: data.quantity,
                category: data.category,
                productImage: currentImages,
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ error: "Failed to update product" });
        }

        res.redirect("/admin/products");

    } catch (error) {
        console.error('Error in editProduct:', error);
        res.status(500).redirect("/pageerror");
    }
};

module.exports={
    getProductAddPage,
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
}