const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express()
const port = process.env.PORT || 5000
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://shop-fusion-server-one.vercel.app',
    'https://shopfusion-sf.web.app'
  ],
  credentials: true
}))

app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.sk1ew0y.mongodb.net/?retryWrites=true&w=majority&appName=cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const productCollection = client.db("shopFusion").collection("product")
    const userCollection = client.db("shopFusion").collection("users")
    const wishlistCollection = client.db("shopFusion").collection("wishlist")
    const checkoutCollection = client.db("shopFusion").collection("checkout")
    const cartCollection = client.db("shopFusion").collection("cart")
    const reviewsCollection = client.db("shopFusion").collection("reviews")
    const paymentCollection = client.db("shopFusion").collection("payment")
    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCRSS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })
    // Logout
    app.post('/logout', async (req, res) => {
      const user = req.body;
      res.clearCookie('token', { maxAge: 0 }).send({ success: true })
    })
    // middlewares 

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access,1' });
      }
      const data = req.headers.authorization.split(' ');
      const token = data[1]
      jwt.verify(token, process.env.ACCRSS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access ,2' })
        }
        req.decoded = decoded;

        next();
      })
    }
    // ..........................wishlist......................
    app.get('/wishlist', async (req, res) => {
      const result = await wishlistCollection.find().toArray();
      res.send(result)
    })

    // app.post('/wishlist', async (req, res) => {
    //   const cartItem = req.body;
    //   const result = await wishlistCollection.insertOne(cartItem)
    //   res.send(result);
    // })
    app.put('/wishlist', async (req, res) => {
      const wishlistItem = req.body;
      const query = { produdctId: wishlistItem?.produdctId }; // Corrected typo in "produdctId"
      const isExist = await wishlistCollection.findOne(query);
      const discount = wishlistItem.discount ? parseFloat(wishlistItem.discount) : 0;
      const percentage = (parseFloat(wishlistItem.price) * discount) / 100;
      const discountPrice = parseFloat(wishlistItem.price) - percentage;


      if (isExist) {
        // Update the quantity if the item already exists
        const newQuantity = isExist.itemQuantity + parseInt(wishlistItem.itemQuantity);
        const newPrice = isExist.price + discountPrice
        const pricedd = newPrice * wishlistItem.itemQuantity
        const result = await wishlistCollection.updateOne(query, {
          $set: {
            itemQuantity: newQuantity,
            price: pricedd,
          },
        });
        return res.send(result);
      }
      // If the item doesn't exist, add it to the cart
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...wishlistItem,
          itemQuantity: parseInt(wishlistItem.itemQuantity),
          price: parseInt(discountPrice) * wishlistItem.itemQuantity, // Ensure itemQuantity is an integer
          Timestamp: Date.now(),
        },
      };
      const result = await wishlistCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    app.delete('/wishlist/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await wishlistCollection.deleteOne(query)
      res.send(result);

    })
    //..............................cart...........................
    app.get('/cart', async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { "email": req.query.email }
      }
      const result = await cartCollection.find(query).toArray();
      res.send(result)
    })

    // Get cart items by userId
    app.get('/cart/:email', async (req, res) => {
      const email = req.params.email
      let query = { 'email': email };
      try {
        const result = await cartCollection.find(query).toArray();
        res.send(result ? result.items : [])
      } catch (error) {
        res.status(500)({ message: error.message });
      }
    });

   
    // Add item to cart
    app.post('/cart', async (req, res) => {
      const cartItem = req.body;
      const query = { productId: cartItem?.productId };

      try {
        let findProduct = await cartCollection.findOne(query);

        if (!findProduct) {
          // If no product exists, create a new entry
          findProduct = { items: [cartItem] };
          await cartCollection.insertOne(findProduct);
        } else {
          // If product exists, check if item is already in the cart
          const itemIndex = findProduct.items.findIndex(item => item.productId === cartItem?.productId);
          if (itemIndex !== -1) {
            findProduct.items[itemIndex].qun += cartItem?.qun ? cartItem?.qun : 1;
          } else {
            findProduct.items.push(cartItem);
          }
          await cartCollection.updateOne(query, { $set: { items: findProduct.items } });
        }

        res.status(200).json({ message: 'Cart updated successfully' });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // app.post('/cart', async (req, res) => {
    //   const cartItem = req.body
    //   const result = await cartCollection.insertOne(cartItem)
    //   res.send(result);
    // })

    app.put('/cart', async (req, res) => {
      const cartItem = req.body;
      const query = { productId: cartItem?.productId }; // Corrected the typo
  
      try {
          // Check if the item exists in the cart
          const isExist = await cartCollection.findOne(query);
  
          // Calculate discount and final price
          const discount = cartItem.discount ? parseFloat(cartItem.discount) : 0;
          const percentage = (parseFloat(cartItem.price) * discount) / 100;
          const discountPrice = parseFloat(cartItem.price) - percentage;
  
          if (isExist) {
              // Update the quantity and price if the item already exists
              const newQuantity = isExist.itemQuantity + parseInt(cartItem.itemQuantity);
              const newPrice = isExist.price + discountPrice;
              const totalPrice = newPrice * cartItem.itemQuantity;
  
              // Update existing item in the cart
              const result = await cartCollection.updateOne(query, {
                  $set: {
                      itemQuantity: newQuantity,
                      price: totalPrice, // Updated price calculation based on quantity
                  },
              });
  
              return res.send(result);
          } else {
              // If the item doesn't exist, add it to the cart
              const options = { upsert: true };
              const updateDoc = {
                  $set: {
                      ...cartItem,
                      itemQuantity: parseInt(cartItem.itemQuantity),
                      price: discountPrice * cartItem.itemQuantity, // Ensure price is calculated correctly
                      Timestamp: Date.now(),
                  },
              };
  
              // Insert the new item or update if it doesn't exist
              const result = await cartCollection.updateOne(query, updateDoc, options);
              res.status(200).json({ message: 'Item added to the cart', result });
             
          }
      } catch (error) {
          res.status(500).json({ message: error.message });
      }
  });
  
    // delete one cart
    app.delete('/cart/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query)
      res.send(result);

    })
    // delete all cart
    app.delete('/cart', async (req, res) => {
      try {
        const result = await cartCollection.deleteMany({});
        res.send({
          message: 'All carts deleted successfully',
          deletedCount: result.deletedCount
        });
      } catch (error) {
        console.error('Error deleting all carts:', error);
        res.status(500).send({ error: 'Failed to delete carts' });
      }
    });


    // .............................product.............................
    app.get('/products', async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result)
    })
    app.get('/product', async (req, res) => {
      const page = parseInt(req.query.page)
      const size = parseInt(req.query.size)
      const filter = req.query.filter
      const sort = req.query.sort
      const search = req.query.search
      // console.log('pagination query',req.query)

      let query = {
        title: { $regex: String(search), $options: 'i' },
      }
      // if (filterBand) query.brandName = filterBand
      if (filter) query.brand = filter
      let options = {}
      if (sort) options = { sort: { createAt: sort === 'asc' ? 1 : -1 } }
      const result = await productCollection.find(query, options).skip(page * size).limit(size).toArray();
      res.send(result)
    })
    app.get('/productCount', async (req, res) => {
      const filter = req.query.filter
      const search = req.query.search
      let query = {
        title: { $regex: String(search), $options: 'i' },
      }
      if (filter) query.brand = filter
      // const count = await shopSwiftlyproduct.estimatedDocumentCount(query);
      const count = await productCollection.countDocuments(query);
      res.send({ count })
    })

    app.get('/product/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await productCollection.findOne(query)
      res.send(result);
    })
    app.post('/product', async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product)
      res.send(result);
    })
    app.put('/updateproducts/:id', async (req, res) => {
      const id = req.params.id;
      const product = req.body;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatequerie = {
        $set: {
          title: product.title,
          brand: product.brand,
          price: product.price,
          descaption: product.descaption,
          category: product.category,
          update: product.update,
          availability_status: product.availability_status,
          minimum_order_quantity: product.minimum_order_quantity,
          return_policy: product.return_policy,
          stock_levels: product.stock_levels,
          discount: product.discount,
          dimensions: product.dimensions,
        }
      };
      const result = await productCollection.updateOne(filter, updatequerie, options);
      res.send(result);
    })

    app.delete('/product/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await productCollection.deleteOne(query)
      res.send(result);

    })

    // ..................................
    app.get('/checkout', async (req, res) => {
      const userEmail = req.query.email; // Assuming the email is passed as a query parameter
      try {
        const result = await checkoutCollection.find({ email: userEmail }).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "An error occurred while fetching checkout data" });
      }
    });
    
    // app.get('/checkout', async (req, res) => {
    //   const result = await checkoutCollection.find().toArray();
    //   res.send(result)

    // })

    app.post('/checkout', async (req, res) => {
      const info = req.body;
      const result = await checkoutCollection.insertOne(info)
      res.send(result);
    })
    //  delete one by one
    app.delete('/checkout/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await checkoutCollection.deleteOne(query)
      res.send(result);

    })
    //  delete all data in one query
    app.delete('/checkout', async (req, res) => {
      try {
        const result = await checkoutCollection.deleteMany({});
        res.send({
          message: 'All checkouts deleted successfully',
          deletedCount: result.deletedCount
        });
      } catch (error) {
        console.error('Error deleting all checkouts:', error);
        res.status(500).send({ error: 'Failed to delete checkouts' });
      }
    });


    // ................comment...........................

    // ....................................................
    app.get('/reviews', async (req, res) => {

      const result = await reviewsCollection.find().toArray();
      res.send(result)
    })
    app.get('/reviews/:id', async (req, res) => {
      const id = req.params.id;
      const query = { 'productId': id }
      const result = await reviewsCollection.find(query).sort({ reviewDate: -1 }).toArray()
      res.send(result)
    })

    app.post('/reviews', async (req, res) => {
      const querie = req.body;
      const result = await reviewsCollection.insertOne(querie)
      res.send(result);
    })

    app.delete('/reviews/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await reviewsCollection.deleteOne(query)
      res.send(result);

    })


    // ...............................users...................................

    app.put('/user', async (req, res) => {
      const user = req.body
      const query = { email: user?.email }
      const isExist = await userCollection.findOne(query)
      if (isExist) {
        if (user.status === 'Requested') {
          const result = await userCollection.updateOne(query, {
            $set: { status: user?.status },
          })
          return res.send(result)
        } else {
          return res.send(isExist)
        }
      }

      const options = { upsert: true }

      const updateDoc = {
        $set: {
          ...user,
          Timestamp: Date.now(),
        },
      }
      const result = await userCollection.updateOne(query, updateDoc, options)
      res.send(result)
    })
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email
      const result = await userCollection.findOne({ email })
      res.send(result)
    })

    // .............................................
    app.get('/filteruser', async (req, res) => {
      const filter = req.query.filter
      const sort = req.query.sort
      let query = {}
      if (filter) query.role = filter
      let options = {}
      if (sort) options = { sort: { Timestamp: sort === 'asc' ? 1 : -1 } }
      const result = await userCollection.find(query, options).toArray()
      res.send(result)
    })

    // ...........................

    app.patch('/users/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email }
      const updateDoc = {
        $set: { ...user, Timestamp: Date.now() },
      }
      const result = await userCollection.updateOne(query, updateDoc)
      res.send(result)
    })


    app.patch('/users/update/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email }
      const updateDoc = {
        $set: { ...user, Timestamp: Date.now() },

      }
      const result = await userCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    // .......................payments..........................

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      if (!price) {
        return res.status(400).send({ error: "Price is required" });
      }

      const amount = parseInt(price * 100); // Convert price to cents

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ['card'],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Stripe error:", error.message);  // Log error to console
        res.status(500).send({ error: error.message });
      }
    });


    app.post('/payments', async (req, res) => {
      const payment = req.body
      const result = await paymentCollection.insertOne(payment)

      res.send({ result })
    })

// .........................................
app.get('/admin-stats',async(req,res)=>{
  const users = await userCollection.estimatedDocumentCount();
  const product = await productCollection.estimatedDocumentCount();
  const orders = await paymentCollection.estimatedDocumentCount();
  const result = await paymentCollection.aggregate([
    {
      $group:{
        _id: null,
        totalRevenue:{
          $sum:'$price'
        }
        // totalRevenue:{
        //   $sum:'$price'
        // }
      }
    }
  ]).toArray()
  const revenue = result.length > 0 ? result[0].totalRevenue : 0;
  res.send({users,product,orders,revenue})
})

// .........................................
app.get('/payment-stats', async(req, res) =>{
  const result = await paymentCollection.aggregate([
    {
      $unwind: '$cartIds'
    },
  {
    $addFields: {
      cartIds: { $toObjectId: "$cartIds" }
    }
  },
    {
      $lookup: {
        from: 'product',
        localField: 'cartIds',
        foreignField: '_id',
        as: 'cartitems'
      }
    },
    {
      $unwind:'$cartitems'
    },
    
    {
      $addFields: {
        "cartitems.price": {
          $cond: {
            if: { $isNumber: "$cartitems.price" },
            then: "$cartitems.price",
            else: { $toDouble: "$cartitems.price" }
          }
        }
      }
    },
    {
      $group: {
        _id: '$cartitems.SubjectCategorey',
        quantity:{ $sum: 1 },
        Revenue:{
          $sum:{
            $add:[
              '$cartitems.TuitionFees',
              '$cartitems.ServiceCharge',
              '$cartitems.TuitionFees'
            ]
          }
        }  
      }
    },   
 
  {
    $project: {
      _id: 0,
      category: "$_id",
      quantity:'$quantity',
      Revenue: '$Revenue'
    }
  }
  ]).toArray();

  res.send(result);

})

// ........................................
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

    // await client.close();
  }
}
run().catch(console.dir);






app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})