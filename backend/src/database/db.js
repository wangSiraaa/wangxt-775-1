const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'complaint_system.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS complaints (
          id TEXT PRIMARY KEY,
          complaint_no TEXT UNIQUE NOT NULL,
          passenger_id TEXT NOT NULL,
          passenger_name TEXT NOT NULL,
          driver_id TEXT,
          driver_name TEXT,
          plate_number TEXT NOT NULL,
          start_time DATETIME NOT NULL,
          end_time DATETIME NOT NULL,
          start_address TEXT NOT NULL,
          end_address TEXT NOT NULL,
          paid_amount REAL NOT NULL,
          expected_amount REAL,
          complaint_description TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending_driver_evidence',
          evidence_deadline DATETIME NOT NULL,
          judged_by TEXT,
          judge_time DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS track_points (
          id TEXT PRIMARY KEY,
          complaint_id TEXT NOT NULL,
          source TEXT NOT NULL,
          timestamp DATETIME NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          speed REAL,
          heading REAL,
          FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS evidence (
          id TEXT PRIMARY KEY,
          complaint_id TEXT NOT NULL,
          submitter_type TEXT NOT NULL,
          submitter_id TEXT NOT NULL,
          evidence_type TEXT NOT NULL,
          content TEXT NOT NULL,
          file_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS meter_records (
          id TEXT PRIMARY KEY,
          complaint_id TEXT NOT NULL,
          start_mileage REAL NOT NULL,
          end_mileage REAL NOT NULL,
          total_mileage REAL NOT NULL,
          waiting_time INTEGER DEFAULT 0,
          unit_price REAL NOT NULL,
          waiting_price REAL DEFAULT 0,
          total_amount REAL NOT NULL,
          record_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS audit_opinions (
          id TEXT PRIMARY KEY,
          complaint_id TEXT NOT NULL,
          auditor_id TEXT NOT NULL,
          auditor_name TEXT NOT NULL,
          track_mileage REAL,
          meter_mileage REAL,
          mileage_diff REAL,
          mileage_diff_percent REAL,
          is_track_missing BOOLEAN DEFAULT 0,
          is_mileage_abnormal BOOLEAN DEFAULT 0,
          detour_detected BOOLEAN DEFAULT 0,
          rule_hits TEXT,
          opinion TEXT NOT NULL,
          suggested_penalty TEXT,
          suggested_compensation REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS conclusions (
          id TEXT PRIMARY KEY,
          complaint_id TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          publisher_id TEXT NOT NULL,
          publisher_name TEXT NOT NULL,
          conclusion TEXT NOT NULL,
          penalty_result TEXT,
          compensation_amount REAL,
          is_review BOOLEAN DEFAULT 0,
          parent_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          complaint_id TEXT NOT NULL,
          operator_id TEXT NOT NULL,
          operator_name TEXT NOT NULL,
          action_type TEXT NOT NULL,
          old_status TEXT,
          new_status TEXT,
          remark TEXT,
          detail_json TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS track_version_compares (
          id TEXT PRIMARY KEY,
          complaint_id TEXT NOT NULL,
          compare_type TEXT NOT NULL,
          version_a INTEGER NOT NULL,
          version_b INTEGER NOT NULL,
          source_a TEXT NOT NULL,
          source_b TEXT NOT NULL,
          mileage_a REAL,
          mileage_b REAL,
          mileage_diff REAL,
          mileage_diff_percent REAL,
          common_points INTEGER,
          diff_points INTEGER,
          detour_segments TEXT,
          compare_result TEXT,
          operator_id TEXT,
          operator_name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS status_change_records (
          id TEXT PRIMARY KEY,
          complaint_id TEXT NOT NULL,
          old_status TEXT NOT NULL,
          new_status TEXT NOT NULL,
          operator_id TEXT,
          operator_name TEXT,
          change_reason TEXT,
          is_auto_trigger BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase,
};
