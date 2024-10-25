import { Client, Databases, ID, Users } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client();

  // Initialize the client and set the endpoint, project, and API key
  client
    .setEndpoint(process.env.APPWRITE_API_ENDPOINT) // Docker internal DNS to connect Appwrite
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const dbId = process.env.APPWRITE_DB_ID;
  const kerelmekId = process.env.APPWRITE_KERELMEK_COLLECTION;
  const szabadsagID = process.env.APPWRITE_SZABADSAG_COLLECTION;
  const plansID = process.env.APPWRITE_PLANS_COLLECTION;
  const tappenzID = process.env.APPWRITE_TAPPENZ_COLLECTION;

  // Validate the environment variables
  if (!dbId || !plansID || !kerelmekId || !szabadsagID || !tappenzID) {
    error("Database or collection ID is missing in environment variables.");
    return res.json({ status: "fail", error: "Server configuration error" });
  }

  const database = new Databases(client);
  const users = new Users(client);

  let submittingId;
  let submittingUser;

  let email;
  let password;
  let name;
  let role;
  let manager;
  let perms;
  let maxdays;
  let remainingdays;
  try {
    const body = JSON.parse(req.body);

    log(`Submitting user: ${body.submittingId}`);
    log(`Email: ${body.email}`);
    log(`Password ${body.password}`);
    log(`Name: ${body.name}`);
    log(`Role: ${body.role}`);
    log(`Manager: ${body.manager}`);
    log(`Perms: ${body.perms}`);
    log(`Maxdays: ${body.maxdays}`);
    log(`Remainingdays: ${body.remainingdays}`);

    // Check if userId exists in the request body
    if (!body || !body.submittingId || !body.email || !body.password || !body.name || !body.role || !body.manager || !body.perms ) {
      throw new Error("submittingId is missing in the request body.");
    }
    submittingId = body.submittingId;
    email = body.email;
    password = body.password;
    name = body.name;
    role = body.role;
    manager = body.manager;
    perms = body.perms;
    maxdays = body.maxdays;
    remainingdays = body.remainingdays

    submittingUser = await users.get(submittingId);
  } catch (parseError) {
    error(`Failed to parse request body or missing submittingId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing submittingId" });
  }

  try {
    if (!submittingUser.prefs.perms.includes("jegyzo.create_user")) {
      error("You are not allowed to create new users.");
      return res.json({ status: "fail", error: "You are not allowed to create new users." });
    }

    const user = await users.createBcryptUser(ID.unique(), email, password, name);
    manager = role == "admin" ? user.$id : manager;
    perms = role == "admin"
      ? ["felhasznalo.request", "felhasznalo.delete_request",
        "irodavezeto.approve", "irpdavezeto.reject",
        "irodavezeto.message_send", "jegyzo.edit_user",
        "jegyzo.create_user", "jegyzo.delete_user", "jegyzo.list_all",
        "hr.edit_user_perms", "hr.edit_user_current_state"]
      : perms;
    let preferences = {
      "perms": perms,
      "manager": manager,
      "role": role,
      "maxdays": !maxdays ? 0 : maxdays,
      "remainingdays": !remainingdays ? 0 : remainingdays,
      "sick": false
    };
    const prefs = await users.updatePrefs(user.$id, preferences);

    await database.createDocument(dbId, plansID, ID.unique(), {
      userId: user.$id,
      managerId: prefs.manager,
      filledOut: false,
    });

    return res.json({ status: "success", user, prefs });
  } catch (err) {
    error(`Failed to create user: ${err.message}`);
    return res.json({ status: "fail", err: "Failed to create user" });
  }
};
