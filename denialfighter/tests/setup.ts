// Test env: separate DB, filesystem storage, local key, console mail. Synthetic data only.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://denial:denial@localhost:5432/denialfighter_test";
process.env.APP_MASTER_KEY = Buffer.from("test-only-key-0123456789abcdefgh").toString("base64");
process.env.KEY_DRIVER = "local";
process.env.STORAGE_DRIVER = "fs";
process.env.STORAGE_FS_DIR = ".data/test-storage";
process.env.MAIL_DRIVER = "console";
process.env.APP_URL = "http://localhost:3000";
