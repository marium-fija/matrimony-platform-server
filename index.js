const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eey3bcc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    await client.connect();


    const db = client.db("matrimony_platform_DB");
    const usersCollection = db.collection("users");
    const biodataCollection = db.collection("biodatas");
    const successStoryCollection = db.collection("successStories");
    const paymentsCollection = db.collection("payments");
    const contactRequestsCollection = db.collection("contactRequests");


     // CREATE biodata
    app.post("/biodatas", async (req, res) => {
  const biodata = req.body;
  const lastBiodata = await biodataCollection.find().sort({ biodataId: -1 }).limit(1).toArray();
  const lastId = lastBiodata.length > 0 ? lastBiodata[0].biodataId : 0;
  biodata.biodataId = lastId + 1;

  const result = await biodataCollection.insertOne(biodata);
  res.send(result);
});
    //1 GET biodata by email
app.get("/biodatas/email/:email", async (req, res) => {
  const email = req.params.email.trim();
  const biodata = await biodataCollection.findOne({ contactEmail: email });
  if (!biodata) return res.status(404).send({ error: "Biodata not found" });
  res.send(biodata);
});

// 2.get biodata Fetch by biodataId
app.get("/biodatas/id/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const biodata = await biodataCollection.findOne({ biodataId: id });
  if (!biodata) return res.status(404).send({ error: "Biodata not found" });
  res.send(biodata);
});

// PUT biodata by email
app.put("/biodatas/email/:email", async (req, res) => {
  const email = req.params.email;
  let updateData = req.body;

  // _id prevent
  if (updateData._id) delete updateData._id;

  try {
    const result = await biodataCollection.updateOne(
      { contactEmail: email },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ error: "Biodata not found" });
    }

    res.send({ message: "Biodata updated successfully" });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).send({ error: "Internal Server Error" });
  }
});
    // GET all biodatas
    app.get("/biodatas", async (req, res) => {
      const biodatas = await biodataCollection.find().toArray();
      res.send(biodatas);
    });

    // CREATE success story
app.post("/success-stories", async (req, res) => {
  const story = req.body;
  try {
    const result = await successStoryCollection.insertOne(story);
    res.status(201).send({
      message: "Success story added successfully",
      storyId: result.insertedId
    });
  } catch (err) {
    console.error("Error adding success story:", err);
    res.status(500).send({ error: "Failed to add success story" });
  }
});

// GET all success stories (latest first)
app.get("/success-stories", async (req, res) => {
  try {
    const stories = await successStoryCollection
      .find()
      .sort({ marriageDate: -1 })
      .toArray();
    res.send(stories);
  } catch (err) {
    console.error("Error fetching success stories:", err);
    res.status(500).send({ error: "Failed to fetch success stories" });
  }
});


// --------------user-------------
    app.post('/users', async (req, res) => {
      const user = req.body;
      user.role = user.role || "user";
      const result = await usersCollection.insertOne(user);
      res.status(201).send(result);
    });

    // GET all users 
    app.get('/users', async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    // GET user role by email
app.get("/users/:email/role", async (req, res) => {
  const email = req.params.email;
  const user = await usersCollection.findOne({ email });
  if (!user) return res.status(404).send({ role: "user" });
  res.send({ role: user.role });
});

// admin check route add
app.get("/users/admin/:email", async (req, res) => {
  const email = req.params.email;
  const user = await usersCollection.findOne({ email });
  res.send({ admin: user?.role === "admin" || false });
});


// ------------------- Admin Dashboard (without middleware) -------------------
    app.get("/admin/stats", async (req, res) => {
      const totalBiodatas = await biodataCollection.estimatedDocumentCount();
      const maleCount = await biodataCollection.countDocuments({ biodataType: "Male" });
      const femaleCount = await biodataCollection.countDocuments({ biodataType: "Female" });
      const premiumCount = await biodataCollection.countDocuments({ Premium: true });
      const revenue = await paymentsCollection.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]).toArray();

      res.send({
        totalBiodatas,
        maleCount,
        femaleCount,
        premiumCount,
        revenue: revenue[0]?.total || 0
      });
    });

     // ------------------- Premium Requests -------------------
    app.get("/approvedPremium", async (req, res) => {
      const requests = await usersCollection.find({ requestPremium: true }).toArray();
      res.send(requests);
    });

    app.patch("/approvedPremium/:id", async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { premium: true }, $unset: { requestPremium: "" } }
      );
      res.send(result);
    });

    // User request premium
app.patch("/users/request-premium/:email", async (req, res) => {
  const email = req.params.email;
  const result = await usersCollection.updateOne(
    { email: email },
    { $set: { requestPremium: true } }
  );
  res.send(result);
});

//---------------------- make a user admin--------------
app.patch("/users/admin/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { role: "admin" } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ error: "User not found" });
    }

    res.send({ message: "User is now an admin", result });
  } catch (err) {
    console.error("Error updating role:", err);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

     // ------------------- Contact Requests -------------------
   // Admin dashboard fetch pending contact requests
app.get("/approvedContactRequest", async (req, res) => {
  const requests = await contactRequestsCollection.find({ status: "pending" }).toArray();
  res.send(requests);
});

// Admin approve request
app.patch("/approvedContactRequest/:id", async (req, res) => {
  const id = req.params.id;
  const result = await contactRequestsCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: "approved" } }
  );
  res.send(result);
});

   app.patch("/users/request-contact-by-email/:email", async (req, res) => {
  const email = req.params.email;
  const result = await usersCollection.updateOne(
    { email: email },
    { $set: { requestContact: true } }
  );
  res.send(result);
});


// Create Payment Intent
app.post("/create-payment-intent", async (req, res) => {
  const { amount } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, 
      currency: "usd",
      payment_method_types: ["card"],
    });
    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});


// ---------------- Contact Requests ----------------

// 1. User creates a contact request (after payment)
app.post("/contactRequests", async (req, res) => {
  try {
    const { biodataId, name, contactEmail, mobileNumber, amount, transactionId } = req.body;

    if (!contactEmail || !biodataId) {
      return res.status(400).send({ error: "Missing required fields" });
    }

    const request = {
      biodataId,
      name: name || null,
      contactEmail,
      mobileNumber: mobileNumber || null,
      amount: amount || null,
      transactionId: transactionId || null,
      status: "pending",
      createdAt: new Date()
    };

    const result = await contactRequestsCollection.insertOne(request);
    res.send(result);
  } catch (err) {
    console.error("Error creating contact request:", err);
    res.status(500).send({ error: "Failed to create contact request" });
  }
});


// 2. Get all contact requests (Admin Dashboard)
app.get("/contactRequests", async (req, res) => {
  const result = await contactRequestsCollection.find().toArray();
  res.send(result);
});

// 3. Approve a request (Admin)
app.patch("/contactRequests/approve/:id", async (req, res) => {
  const id = req.params.id;
  const result = await contactRequestsCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: "approved" } }
  );
  res.send(result);
});

// 4. Get my requests (User Dashboard)
app.get("/contactRequests/user/:email", async (req, res) => {
  const email = req.params.email;
  const result = await contactRequestsCollection.find({ "transactionId": { $ne: null }, "status": { $in: ["pending", "approved"] }, }).toArray();
  res.send(result);
});

// 5. Delete request (User)
app.delete("/contactRequests/:id", async (req, res) => {
  const id = req.params.id;
  const result = await contactRequestsCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Matrimony platform Server is running');
});


app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});

