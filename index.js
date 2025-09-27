const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require("jsonwebtoken");

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

// JWT middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).send({ message: "Unauthorized access" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: "Forbidden access" });
    req.user = decoded;
    next();
  });
};

// Verify Admin middleware
const verifyAdmin = async (req, res, next) => {
  const email = req.user?.email;
  const user = await usersCollection.findOne({ email: email });
  if (user?.role !== "admin") {
    return res.status(403).send({ message: "Forbidden: Admin only" });
  }
  next();
};

let usersCollection, biodataCollection, successStoryCollection, paymentsCollection;

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const db = client.db("matrimony_platform_DB");
    const usersCollection = db.collection("users");
    const biodataCollection = db.collection("biodatas");
    const successStoryCollection = db.collection("successStories");
    const paymentsCollection = db.collection("payments")

     // CREATE biodata
    app.post("/biodatas", async (req, res) => {
  const biodata = req.body;
  const lastBiodata = await biodataCollection.find().sort({ biodataId: -1 }).limit(1).toArray();
  const lastId = lastBiodata.length > 0 ? lastBiodata[0].biodataId : 0;
  biodata.biodataId = lastId + 1;

  const result = await biodataCollection.insertOne(biodata);
  res.send(result);
});
    // GET biodata by email
app.get("/biodatas/email/:email", async (req, res) => {
  const email = req.params.email;
  const biodata = await biodataCollection.findOne({ contactEmail: email });
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


// Generate JWT token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });
      res.send({ token });
    });
    // ------------------- Users -------------------
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


    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const search = req.query.search || "";
      const query = search ? { name: { $regex: search, $options: "i" } } : {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: "admin" } }
      );
      res.send(result);
    });

    app.patch("/users/premium/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { premium: true } }
      );
      res.send(result);
    });

    // ------------------- Admin Dashboard -------------------
    app.get("/admin/stats", verifyToken, verifyAdmin, async (req, res) => {
      const totalBiodatas = await biodataCollection.estimatedDocumentCount();
      const maleCount = await biodataCollection.countDocuments({ biodataType: "Male" });
      const femaleCount = await biodataCollection.countDocuments({ biodataType: "Female" });
      const premiumCount = await biodataCollection.countDocuments({ Premium: true });
      const revenue = await paymentsCollection.aggregate([
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]).toArray();

      res.send({
        totalBiodatas,
        maleCount,
        femaleCount,
        premiumCount,
        revenue: revenue[0]?.total || 0
      });
    });

    // ------------------- Premium Approval -------------------
    app.get("/approvedPremium", verifyToken, verifyAdmin, async (req, res) => {
      const requests = await usersCollection.find({ requestPremium: true }).toArray();
      res.send(requests);
    });

    app.patch("/approvedPremium/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { premium: true }, $unset: { requestPremium: "" } }
      );
      res.send(result);
    });

    // ------------------- Contact Request Approval -------------------
    app.get("/approvedContactRequest", verifyToken, verifyAdmin, async (req, res) => {
      const requests = await usersCollection.find({ requestContact: { $exists: true } }).toArray();
      res.send(requests);
    });

    app.patch("/approvedContactRequest/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { approvedContact: true }, $unset: { requestContact: "" } }
      );
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




// // POST route to add a new user
//     app.post('/users', async (req, res) => {
//       const user = req.body; 
//        user.role = user.role || "user";
//       if (!user.name || !user.email) {
//         return res.status(400).send({ error: 'Name, email, and password are required' });
//       }
//       try {
//         const result = await usersCollection.insertOne(user);
//         res.status(201).send({
//           message: 'User created successfully',
//           userId: result.insertedId
//         });
//         } catch (err) {
//         console.error(err);
//         res.status(500).send({ error: 'Failed to create user' });
//       }
//     });

//     // GET all users (optional, for testing)
//     app.get('/users', async (req, res) => {
//       const users = await usersCollection.find().toArray();
//       res.send(users);
//     });
