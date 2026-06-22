"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var db_1 = require("@/app/lib/db");
function migrate() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🛠️  Running return table migration...");
                    // ── Extend wallet_reason enum ───────────────────────────────
                    return [4 /*yield*/, (0, db_1.default)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["ALTER TYPE wallet_reason ADD VALUE IF NOT EXISTS 'customer_refund'"], ["ALTER TYPE wallet_reason ADD VALUE IF NOT EXISTS 'customer_refund'"])))];
                case 1:
                    // ── Extend wallet_reason enum ───────────────────────────────
                    _a.sent();
                    console.log("  ✓ Extended wallet_reason enum");
                    // ── returns ─────────────────────────────────────────────────
                    return [4 /*yield*/, (0, db_1.default)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    CREATE TABLE IF NOT EXISTS returns (\n      id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),\n      invoice_id      UUID           NOT NULL REFERENCES invoices(id)  ON DELETE RESTRICT,\n      created_by      UUID           NOT NULL REFERENCES users(id)     ON DELETE RESTRICT,\n      credit_amount   NUMERIC(12, 2) NOT NULL CHECK (credit_amount > 0),\n      resolution_type TEXT           NOT NULL CHECK (resolution_type IN ('credit', 'cash_refund')),\n      reason          TEXT,\n      notes           TEXT,\n      created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()\n    )\n  "], ["\n    CREATE TABLE IF NOT EXISTS returns (\n      id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),\n      invoice_id      UUID           NOT NULL REFERENCES invoices(id)  ON DELETE RESTRICT,\n      created_by      UUID           NOT NULL REFERENCES users(id)     ON DELETE RESTRICT,\n      credit_amount   NUMERIC(12, 2) NOT NULL CHECK (credit_amount > 0),\n      resolution_type TEXT           NOT NULL CHECK (resolution_type IN ('credit', 'cash_refund')),\n      reason          TEXT,\n      notes           TEXT,\n      created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()\n    )\n  "])))];
                case 2:
                    // ── returns ─────────────────────────────────────────────────
                    _a.sent();
                    // ── return_items ─────────────────────────────────────────────
                    return [4 /*yield*/, (0, db_1.default)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    CREATE TABLE IF NOT EXISTS return_items (\n      id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),\n      return_id       UUID           NOT NULL REFERENCES returns(id)       ON DELETE CASCADE,\n      invoice_item_id UUID           REFERENCES invoice_items(id)          ON DELETE SET NULL,\n      product_id      UUID           REFERENCES products(id)               ON DELETE SET NULL,\n      product_name    VARCHAR(255)   NOT NULL,\n      unit_price      NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),\n      quantity        INT            NOT NULL CHECK (quantity > 0),\n      line_total      NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0)\n    )\n  "], ["\n    CREATE TABLE IF NOT EXISTS return_items (\n      id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),\n      return_id       UUID           NOT NULL REFERENCES returns(id)       ON DELETE CASCADE,\n      invoice_item_id UUID           REFERENCES invoice_items(id)          ON DELETE SET NULL,\n      product_id      UUID           REFERENCES products(id)               ON DELETE SET NULL,\n      product_name    VARCHAR(255)   NOT NULL,\n      unit_price      NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),\n      quantity        INT            NOT NULL CHECK (quantity > 0),\n      line_total      NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0)\n    )\n  "])))];
                case 3:
                    // ── return_items ─────────────────────────────────────────────
                    _a.sent();
                    console.log("  ✓ returns and return_items tables created");
                    // ── Wallet trigger: deduct EGP on cash_refund return ─────────
                    return [4 /*yield*/, (0, db_1.default)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    CREATE OR REPLACE FUNCTION fn_return_sync_wallet()\n    RETURNS TRIGGER LANGUAGE plpgsql AS $$\n    BEGIN\n      IF NEW.resolution_type = 'cash_refund' THEN\n        INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id)\n        VALUES ('EGP', NEW.credit_amount, 'out', 'customer_refund', NEW.id);\n        UPDATE company_wallet\n        SET egp_balance = egp_balance - NEW.credit_amount,\n            updated_at  = NOW();\n      END IF;\n      RETURN NULL;\n    END;\n    $$\n  "], ["\n    CREATE OR REPLACE FUNCTION fn_return_sync_wallet()\n    RETURNS TRIGGER LANGUAGE plpgsql AS $$\n    BEGIN\n      IF NEW.resolution_type = 'cash_refund' THEN\n        INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id)\n        VALUES ('EGP', NEW.credit_amount, 'out', 'customer_refund', NEW.id);\n        UPDATE company_wallet\n        SET egp_balance = egp_balance - NEW.credit_amount,\n            updated_at  = NOW();\n      END IF;\n      RETURN NULL;\n    END;\n    $$\n  "])))];
                case 4:
                    // ── Wallet trigger: deduct EGP on cash_refund return ─────────
                    _a.sent();
                    return [4 /*yield*/, (0, db_1.default)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["DROP TRIGGER IF EXISTS trg_return_sync_wallet ON returns"], ["DROP TRIGGER IF EXISTS trg_return_sync_wallet ON returns"])))];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, (0, db_1.default)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    CREATE TRIGGER trg_return_sync_wallet\n      AFTER INSERT ON returns\n      FOR EACH ROW EXECUTE FUNCTION fn_return_sync_wallet()\n  "], ["\n    CREATE TRIGGER trg_return_sync_wallet\n      AFTER INSERT ON returns\n      FOR EACH ROW EXECUTE FUNCTION fn_return_sync_wallet()\n  "])))];
                case 6:
                    _a.sent();
                    console.log("  ✓ Wallet trigger for returns created");
                    // ── Indexes ───────────────────────────────────────────────────
                    return [4 /*yield*/, (0, db_1.default)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["CREATE INDEX IF NOT EXISTS idx_returns_invoice      ON returns(invoice_id)"], ["CREATE INDEX IF NOT EXISTS idx_returns_invoice      ON returns(invoice_id)"])))];
                case 7:
                    // ── Indexes ───────────────────────────────────────────────────
                    _a.sent();
                    return [4 /*yield*/, (0, db_1.default)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["CREATE INDEX IF NOT EXISTS idx_return_items_return  ON return_items(return_id)"], ["CREATE INDEX IF NOT EXISTS idx_return_items_return  ON return_items(return_id)"])))];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, (0, db_1.default)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["CREATE INDEX IF NOT EXISTS idx_return_items_product ON return_items(product_id)"], ["CREATE INDEX IF NOT EXISTS idx_return_items_product ON return_items(product_id)"])))];
                case 9:
                    _a.sent();
                    console.log("  ✓ Indexes created");
                    console.log("✅  Return table migration complete.");
                    return [2 /*return*/];
            }
        });
    });
}
migrate().catch(function (err) {
    console.error("Migration failed:", err);
    process.exit(1);
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9;
