const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express()
const port = process.env.PORT || 5000


app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
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

    app.get('/cart/:email', async (req, res) => {
      const email = req.params.email
      let query = { 'email': email };
      const result = await cartCollection.find(query).toArray();
      res.send(result)
    })

    // app.get('/user/:email', async (req, res) => {
    //   const email = req.params.email
    //   const result = await userCollection.findOne({ email })
    //   res.send(result)
    // })

    // app.post('/cart', async (req, res) => {
    //   const cartItem = req.body
    //   const result = await cartCollection.insertOne(cartItem)
    //   res.send(result);
    // })

    app.put('/cart', async (req, res) => {
      const cartItem = req.body;
      const query = { produdctId: cartItem?.produdctId }; // Corrected typo in "produdctId"
      const isExist = await cartCollection.findOne(query);
      const discount = cartItem.discount ? parseFloat(cartItem.discount) : 0;
      const percentage = (parseFloat(cartItem.price) * discount) / 100;
      const discountPrice = parseFloat(cartItem.price) - percentage;

      if (isExist) {
        // Update the quantity if the item already exists
        const newQuantity = isExist.itemQuantity + parseInt(cartItem.itemQuantity);
        const newPrice = isExist.price + discountPrice
        const pricedd = newPrice * cartItem.itemQuantity
        const result = await cartCollection.updateOne(query, {
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
          ...cartItem,
          itemQuantity: parseInt(cartItem.itemQuantity),
          price: parseInt(discountPrice) * cartItem.itemQuantity, // Ensure itemQuantity is an integer
          Timestamp: Date.now(),
        },
      };
      const result = await cartCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    app.delete('/cart/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query)
      res.send(result);

    })

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
    app.post('/checkout', async (req, res) => {
      const info = req.body;
      const result = await checkoutCollection.insertOne(info)
      res.send(result);
    })



    // ................comment...........................

    // ....................................................
    app.get('/reviews', async (req, res) => {
      //   const review = req.body;
      //  const query = { _id: review.productId }
      //   console.log(query,review);
      const result = await reviewsCollection.find().toArray();
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
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card'],

      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post('/payments', verifyToken, async (req, res) => {
      const payment = req.body
      const result = await paymentCollection.insertOne(payment)

      res.send({ result })
    })





    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
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