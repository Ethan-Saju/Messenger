import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

const saltRounds = 10;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "messenger",
  password: "YOUR_PASSWORD", //replace
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "YOUR_SECRET", //replace
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "register.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.post("/register", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  bcrypt.hash(password, saltRounds, async (err, hash) => {
    try {
      await db.query("INSERT INTO users VALUES($1,$2);", [username, hash]);
      res.json({ status: "ok" });
    } catch (error) {
      res.json({ status: "error" });
    }
  });
});

app.post("/login", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  const result = await db.query("select * from users where username=$1", [
    username,
  ]);

  if (result.rows.length == 0) {
    res.json({ status: "error" });
  } else {
    const validateUser = await bcrypt.compare(
      password,
      result.rows[0].password
    );
    if (validateUser) {
      req.session.user = { username: username };
      res.json({ status: "ok" });
    } else {
      res.json({ status: "error" });
    }
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect("/home");
    }

    return res.redirect("/login");
  });
});

app.get("/home", (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, "views", "index.html"));
  } else {
    res.redirect("/login");
  }
});

app.get("/friends", (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, "views", "friends.html"));
  } else {
    res.redirect("/login");
  }
});

app.post("/friend-request", async (req, res) => {
  const currentUser = req.session.user.username;
  const newFriend = req.body.username;

  //Request to Self
  if (newFriend == currentUser) {
    return res.json({ status: "Cannot send friend request to self" });
  }

  //Already Friends
  let result = await db.query(
    "SELECT * FROM friends WHERE friendA = $1 AND friendB = $2",
    [currentUser, newFriend]
  );

  if (result.rows.length > 0) {
    return res.json({ status: "User is already a friend" });
  }

  //Pending Request from either Side
  result = await db.query(
    "select * from pending where (sender = $1 and receiver=$2) or (sender=$2 and receiver=$1)",
    [currentUser, newFriend]
  );

  if (result.rows.length > 0) {
    return res.json({ status: "Request Already Pending" });
  }

  //User not found

  result = await db.query("select * from users where username=$1", [newFriend]);

  if (result.rows.length === 0) {
    return res.json({ status: "User not found" });
  }

  //All Tests Passed

  await db.query("insert into pending values($1,$2)", [currentUser, newFriend]);

  return res.json({ status: "ok" });
});

app.get("/pending-reqs", async (req, res) => {
  const result = await db.query(
    "select sender from pending where receiver=$1",
    [req.session.user.username]
  );
  res.json({ rows: result.rows });
});

app.post("/add-friend", async (req, res) => {
  const newFriend = req.body.sender;
  console.log(
    `Creating friends: ${newFriend + " and " + req.session.user.username}`
  );
  await db.query(
    "INSERT INTO friends VALUES ($1, $2,'seen'), ($2, $1,'seen')",
    [req.session.user.username, newFriend]
  );

  await db.query("delete from pending where sender=$1 and receiver=$2", [
    newFriend,
    req.session.user.username,
  ]);

  await db.query(
    "insert into messages(receiver, sender, timestamp, content) values ($1, $2, $3, $4)",
    [
      newFriend,
      req.session.user.username,
      new Date("2000-01-01T00:00:00Z"),
      "Filler Message",
    ]
  );

  await db.query(
    "insert into messages(receiver, sender, timestamp, content) values ($1, $2, $3, $4)",
    [
      req.session.user.username,
      newFriend,
      new Date("2000-01-01T00:00:00Z"),
      "Filler Message",
    ]
  );

  return res.json({ status: "ok" });
});

app.post("/delete-friendrequest", async (req, res) => {
  const newFriend = req.body.sender;

  await db.query("delete from pending where receiver=$1 and sender=$2", [
    req.session.user.username,
    newFriend,
  ]);

  return res.json({ status: "ok" });
});

app.get("/get-friends", async (req, res) => {
  const result = await db.query(
    `
    SELECT *
    FROM (
      SELECT DISTINCT ON (friend) *
      FROM (
        SELECT *,
               CASE 
                 WHEN sender = $1 THEN receiver 
                 ELSE sender 
               END AS friend
        FROM messages
        WHERE sender = $1 OR receiver = $1
        ORDER BY friend, timestamp DESC
      ) AS recent_messages
      ORDER BY friend, timestamp DESC
    ) AS distinct_friends
    ORDER BY timestamp DESC;
    `,
    [req.session.user.username]
  );

  res.json({ rows: result.rows });
});

app.post("/delete-friend", async (req, res) => {
  const friend = req.body.friend;

  await db.query(
    "delete from friends where (friendA=$1 and friendB=$2) or (friendA=$2 and friendB=$1)",
    [req.session.user.username, friend]
  );

  await db.query(
    "delete from messages where (sender=$1 and receiver=$2) or (sender=$2 and receiver=$1)",
    [req.session.user.username, friend]
  );

  return res.json({ status: "ok" });
});

app.post("/send", async (req, res) => {
  const timestamp = new Date().toISOString();

  await db.query(
    "insert into messages(receiver,sender,timestamp,content) values ($1,$2,$3,$4)",
    [req.body.receiver, req.session.user.username, timestamp, req.body.content]
  );

  await db.query(
    "update friends set seen='unseen' where frienda=$1 and friendb=$2",
    [req.body.receiver, req.session.user.username]
  );
  res.json({ status: "ok" });
});

app.get("/getMessages", async (req, res) => {
  const result = await db.query(
    "select sender,receiver,content from messages  where ((sender=$1 and receiver=$2) or (sender=$2 and receiver=$1)) and (timestamp>'2000-01-01 05:30:00' ) order by timestamp desc limit 50 ",
    [req.session.user.username, req.query.receiver]
  );

  res.json({ rows: result.rows.reverse() });
});

app.get("/getSeenStatus", async (req, res) => {
  const result = await db.query(
    "select seen from friends where frienda=$1 and friendb=$2",
    [req.session.user.username, req.query.friend]
  );

  res.json({ seen: result.rows[0].seen });
});

app.get("/markAsSeen", async (req, res) => {
  await db.query(
    "update friends set seen='seen' where frienda=$1 and friendb=$2",
    [req.session.user.username, req.query.friend]
  );
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Successfully started server on port ${port}.`);
});
