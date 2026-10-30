#!/usr/bin/env python3
"""
ClearMark — PostgreSQL Database Viewer & Schema Explorer
"Remove marks. Keep memories."

Connects to actual PostgreSQL database using SQLAlchemy.
Read-only for data viewing: Never modifies, inserts, or deletes records.
Never logs or prints database passwords.

© 2026 Rifath Shifa M. All Rights Reserved.
Developed by Rifath Shifa M
"""

import os
import sys
import re
from urllib.parse import urlparse
from datetime import datetime

FOOTER_COPYRIGHT = "(c) 2026 Rifath Shifa M. All Rights Reserved."
FOOTER_DEVELOPER = "Developed by Rifath Shifa M"
APP_NAME = "ClearMark"
APP_TAGLINE = "Remove marks. Keep memories."

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(script_dir, "backend"))

# Load environment variables from backend/.env and root .env
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(script_dir, ".env"))
    load_dotenv(os.path.join(script_dir, "backend", ".env"))
except ImportError:
    pass

try:
    import sqlalchemy
    from sqlalchemy import create_engine, inspect, text
except ImportError:
    print("[ERROR] SQLAlchemy is not installed!")
    print("Please run: pip install sqlalchemy psycopg2-binary")
    input("\nPress Enter to exit...")
    sys.exit(1)

# Import models for optional table initialization
try:
    from database import Base, User, File as DBFile, ProcessedFile as DBProcessedFile, ProcessingJob as DBProcessingJob
    HAS_MODELS = True
except Exception:
    HAS_MODELS = False


def mask_url_password(url_str: str) -> str:
    """Masks password inside a database connection URL string."""
    if not url_str:
        return ""
    return re.sub(r":([^:@/]+)@", ":****@", url_str)


def get_connection_info(url_str: str) -> dict:
    """Safely extracts connection metadata without exposing password."""
    try:
        clean_url = url_str
        if clean_url.startswith("postgres://"):
            clean_url = "postgresql://" + clean_url[11:]
        parsed = urlparse(clean_url)
        return {
            "dialect": parsed.scheme.split("+")[0],
            "username": parsed.username or "default",
            "host": parsed.hostname or "localhost",
            "port": parsed.port or 5432,
            "database": (parsed.path or "").lstrip("/"),
            "masked_url": mask_url_password(url_str),
        }
    except Exception:
        return {"masked_url": mask_url_password(url_str)}


def save_env_database_url(new_url: str):
    """Saves updated DATABASE_URL to backend/.env and root .env."""
    for env_path in [os.path.join(script_dir, ".env"), os.path.join(script_dir, "backend", ".env")]:
        lines = []
        replaced = False
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("DATABASE_URL="):
                        lines.append(f"DATABASE_URL={new_url}\n")
                        replaced = True
                    else:
                        lines.append(line)
        if not replaced:
            lines.append(f"DATABASE_URL={new_url}\n")

        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
    os.environ["DATABASE_URL"] = new_url


def update_password_in_url(current_url: str, new_password: str) -> str:
    """Replaces password in connection string with user's input."""
    # Pattern: postgresql://user:oldpass@host...
    match = re.match(r"^(postgres(?:ql)?://[^:]+:)([^@]+)(@.+)$", current_url)
    if match:
        return f"{match.group(1)}{new_password}{match.group(3)}"
    return current_url


def format_cell(val, max_len=30):
    """Formats cell values gracefully for tabular display."""
    if val is None:
        return "<NULL>"
    if isinstance(val, (bytes, bytearray)):
        return f"<{len(val)} bytes>"
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d %H:%M:%S")
    s = str(val).replace("\r", " ").replace("\n", " ").strip()
    if len(s) > max_len:
        return s[:max_len - 3] + "..."
    return s


def print_table(headers, rows, max_col_width=32):
    """Prints an ASCII table with headers and clean borders."""
    if not headers:
        print("  (No columns to display)")
        return

    str_rows = [[format_cell(c, max_col_width) for c in row] for row in rows]
    col_widths = [len(h) for h in headers]
    for row in str_rows:
        for idx, cell in enumerate(row):
            if idx < len(col_widths):
                col_widths[idx] = max(col_widths[idx], len(cell))

    col_widths = [min(w, max_col_width) for w in col_widths]
    border = "+" + "+".join(["-" * (w + 2) for w in col_widths]) + "+"
    header_str = "|" + "|".join([f" {headers[i]:<{col_widths[i]}} " for i in range(len(headers))]) + "|"

    print(border)
    print(header_str)
    print(border)
    if not str_rows:
        empty_msg = "No records found"
        print(f"| {empty_msg:<{sum(col_widths) + len(col_widths)*3 - 3}} |")
    else:
        for row in str_rows:
            line = "|" + "|".join([f" {row[i]:<{col_widths[i]}} " if i < len(row) else " " * (col_widths[i] + 2) for i in range(len(headers))]) + "|"
            print(line)
    print(border)


def print_footer():
    """Prints clean, professional, neatly aligned footer."""
    print("\n" + "=" * 65)
    print(f" {APP_NAME} - {APP_TAGLINE}")
    print(f" {FOOTER_COPYRIGHT}")
    print(f" {FOOTER_DEVELOPER}")
    print("=" * 65)


class DatabaseViewer:
    def __init__(self, db_url: str):
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        self.db_url = db_url
        self.info = get_connection_info(db_url)
        self.engine = None
        self.inspector = None
        self.last_error = None

    def connect(self) -> bool:
        """Establishes connection to PostgreSQL and inspects metadata."""
        try:
            self.engine = create_engine(
                self.db_url,
                pool_pre_ping=True,
                connect_args={"sslmode": "require"} if "sslmode=require" in self.db_url else {}
            )
            with self.engine.connect() as conn:
                pass
            self.inspector = inspect(self.engine)
            self.last_error = None
            return True
        except Exception as e:
            err_msg = str(e)
            if self.db_url and ":" in self.db_url:
                try:
                    pw = urlparse(self.db_url).password
                    if pw:
                        err_msg = err_msg.replace(pw, "****")
                except Exception:
                    pass
            self.last_error = err_msg
            return False

    def get_tables(self) -> list:
        """Returns sorted list of tables in database."""
        if not self.inspector:
            return []
        try:
            return sorted(self.inspector.get_table_names())
        except Exception as e:
            print(f"[Error fetching tables]: {e}")
            return []

    def get_record_count(self, table_name: str) -> int:
        """Gets exact count of rows in a table (read-only query)."""
        try:
            with self.engine.connect() as conn:
                res = conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"'))
                return res.scalar() or 0
        except Exception:
            return 0

    def view_table_paginated(self, table_name: str, page_size: int = 15):
        """Displays table records with interactive pagination."""
        total_rows = self.get_record_count(table_name)
        if total_rows == 0:
            print(f"\nTable '{table_name}' is currently empty (0 records).")
            input("\nPress Enter to return to menu...")
            return

        columns = [c["name"] for c in self.inspector.get_columns(table_name)]
        current_page = 0
        total_pages = (total_rows + page_size - 1) // page_size

        while True:
            offset = current_page * page_size
            query_sql = f'SELECT * FROM "{table_name}" LIMIT {page_size} OFFSET {offset}'
            with self.engine.connect() as conn:
                result = conn.execute(text(query_sql))
                rows = result.fetchall()

            start_idx = offset + 1
            end_idx = min(offset + len(rows), total_rows)
            print("\n" + "=" * 70)
            print(f" TABLE: {table_name} | Page {current_page + 1} of {total_pages} | Showing rows {start_idx}-{end_idx} of {total_rows}")
            print("=" * 70)
            print_table(columns, rows)

            print(f"\n[Navigation]: [N] Next | [P] Previous | [B] Back to Menu | [G <num>] Jump to Page")
            cmd = input(f"Select option [{current_page + 1}/{total_pages}]: ").strip().lower()

            if cmd in ("b", "q", ""):
                break
            elif cmd == "n":
                if current_page < total_pages - 1:
                    current_page += 1
                else:
                    print("--> Already at last page.")
            elif cmd == "p":
                if current_page > 0:
                    current_page -= 1
                else:
                    print("--> Already at first page.")
            elif cmd.startswith("g"):
                parts = cmd.split()
                if len(parts) > 1 and parts[1].isdigit():
                    target = int(parts[1]) - 1
                    if 0 <= target < total_pages:
                        current_page = target
                    else:
                        print(f"--> Page out of range (1-{total_pages})")
                else:
                    print("--> Usage: g <page_number>")

    def print_schema(self):
        """Displays full schema definition for each table."""
        tables = self.get_tables()
        if not tables:
            print("[INFO] No tables found in database.")
            input("\nPress Enter to return to menu...")
            return

        print("\n" + "=" * 75)
        print(f" {APP_NAME} — POSTGRESQL DATABASE SCHEMA")
        print("=" * 75)

        for table in tables:
            print(f"\nTABLE: {table} ({self.get_record_count(table)} records)")
            print("-" * 75)
            cols = self.inspector.get_columns(table)
            pk_constraint = self.inspector.get_pk_constraint(table)
            pk_cols = set(pk_constraint.get("constrained_columns", [])) if pk_constraint else set()
            fk_list = self.inspector.get_foreign_keys(table)

            fk_map = {}
            for fk in fk_list:
                ref_table = fk.get("referred_table")
                for local_col, ref_col in zip(fk.get("constrained_columns", []), fk.get("referred_columns", [])):
                    fk_map[local_col] = f"{ref_table}.{ref_col}"

            col_headers = ["Column Name", "Data Type", "Nullable", "Key / Reference"]
            col_rows = []
            for c in cols:
                name = c["name"]
                dtype = str(c["type"])
                nullable = "YES" if c.get("nullable", True) else "NO"
                key_info = []
                if name in pk_cols:
                    key_info.append("PRIMARY KEY")
                if name in fk_map:
                    key_info.append(f"FK -> {fk_map[name]}")
                col_rows.append([name, dtype, nullable, ", ".join(key_info) if key_info else "-"])

            print_table(col_headers, col_rows, max_col_width=35)

        print_footer()
        input("\nPress Enter to return to menu...")

    def export_sql_schema(self, output_path="database_schema.sql"):
        """Exports actual database DDL schema to an SQL file."""
        tables = self.get_tables()
        if not tables:
            print("[WARN] No tables to export.")
            return

        sql_lines = [
            "-- ========================================================",
            f"-- {APP_NAME} PostgreSQL Database Schema Export",
            f"-- {APP_TAGLINE}",
            f"-- {FOOTER_COPYRIGHT}",
            f"-- {FOOTER_DEVELOPER}",
            f"-- Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"-- Target: {self.info.get('host')}:{self.info.get('port')}/{self.info.get('database')}",
            "-- ========================================================\n",
        ]

        for table in tables:
            cols = self.inspector.get_columns(table)
            pk_constraint = self.inspector.get_pk_constraint(table)
            pk_cols = pk_constraint.get("constrained_columns", []) if pk_constraint else []
            fks = self.inspector.get_foreign_keys(table)

            sql_lines.append(f"CREATE TABLE IF NOT EXISTS {table} (")
            defs = []
            for c in cols:
                cname = c["name"]
                ctype = str(c["type"]).upper()
                null_str = "" if c.get("nullable", True) else " NOT NULL"
                defs.append(f"    {cname} {ctype}{null_str}")

            if pk_cols:
                defs.append(f"    PRIMARY KEY ({', '.join(pk_cols)})")

            for fk in fks:
                local_cols = ", ".join(fk["constrained_columns"])
                ref_table = fk["referred_table"]
                ref_cols = ", ".join(fk["referred_columns"])
                defs.append(f"    FOREIGN KEY ({local_cols}) REFERENCES {ref_table} ({ref_cols})")

            sql_lines.append(",\n".join(defs))
            sql_lines.append(");\n")

        sql_lines.append("-- ========================================================")
        sql_lines.append(f"-- End of {APP_NAME} Schema Export")
        sql_lines.append(f"-- {FOOTER_COPYRIGHT}")
        sql_lines.append(f"-- {FOOTER_DEVELOPER}")
        sql_lines.append("-- ========================================================")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(sql_lines))

        print(f"[SUCCESS] Exported actual SQL schema to: {os.path.abspath(output_path)}")

    def export_er_diagram(self, output_path="database_diagram.png"):
        """Generates an aesthetic high-resolution ER diagram PNG using Pillow."""
        try:
            from PIL import Image, ImageDraw, ImageFont
        except ImportError:
            print("[ERROR] Pillow (PIL) is required to render diagram PNG.")
            return

        tables = self.get_tables()
        if not tables:
            print("[WARN] No tables to render in ER diagram.")
            return

        table_meta = {}
        for table in tables:
            cols = self.inspector.get_columns(table)
            pk_constraint = self.inspector.get_pk_constraint(table)
            pk_cols = set(pk_constraint.get("constrained_columns", [])) if pk_constraint else set()
            fks = self.inspector.get_foreign_keys(table)
            fk_map = {}
            for fk in fks:
                ref_table = fk.get("referred_table")
                for lc, rc in zip(fk.get("constrained_columns", []), fk.get("referred_columns", [])):
                    fk_map[lc] = (ref_table, rc)

            row_count = self.get_record_count(table)
            table_meta[table] = {
                "columns": cols,
                "pks": pk_cols,
                "fks": fk_map,
                "rows": row_count
            }

        try:
            title_font = ImageFont.truetype("arial.ttf", 22)
            header_font = ImageFont.truetype("arial.ttf", 16)
            row_font = ImageFont.truetype("arial.ttf", 13)
            small_font = ImageFont.truetype("arial.ttf", 11)
            footer_font = ImageFont.truetype("arial.ttf", 12)
        except Exception:
            title_font = ImageFont.load_default()
            header_font = title_font
            row_font = title_font
            small_font = title_font
            footer_font = title_font

        card_w = 340
        row_h = 24
        header_h = 44
        margin_x = 50
        margin_y = 100
        gap_x = 60
        gap_y = 60
        cols_per_row = 2
        footer_banner_h = 48

        coords = {}
        max_canvas_w = margin_x * 2 + card_w * cols_per_row + gap_x * (cols_per_row - 1)
        cur_y_col = [margin_y] * cols_per_row

        for idx, table in enumerate(tables):
            c_idx = idx % cols_per_row
            x = margin_x + c_idx * (card_w + gap_x)
            y = cur_y_col[c_idx]

            num_cols = len(table_meta[table]["columns"])
            card_h = header_h + num_cols * row_h + 12
            coords[table] = {"x": x, "y": y, "w": card_w, "h": card_h}
            cur_y_col[c_idx] += card_h + gap_y

        canvas_h = max(cur_y_col) + 40 + footer_banner_h
        canvas_w = max_canvas_w

        img = Image.new("RGB", (canvas_w, canvas_h), (248, 250, 252))
        draw = ImageDraw.Draw(img)

        # Header Title Banner
        draw.rectangle([0, 0, canvas_w, 64], fill=(30, 41, 59))
        draw.text((30, 14), f"{APP_NAME} — PostgreSQL Entity-Relationship Diagram", fill=(255, 255, 255), font=title_font)
        draw.text((30, 40), f'"{APP_TAGLINE}"', fill=(199, 210, 254), font=small_font)
        draw.text((canvas_w - 240, 24), f"Database: {self.info.get('database')}", fill=(148, 163, 184), font=row_font)

        # Draw Table Cards
        for table, pos in coords.items():
            x, y, w, h = pos["x"], pos["y"], pos["w"], pos["h"]
            draw.rectangle([x, y, x + w, y + h], fill=(255, 255, 255), outline=(203, 213, 225), width=2)
            draw.rectangle([x, y, x + w, y + header_h], fill=(79, 70, 229))
            draw.text((x + 14, y + 12), table, fill=(255, 255, 255), font=header_font)
            row_badge = f"{table_meta[table]['rows']} rows"
            draw.text((x + w - 80, y + 15), row_badge, fill=(224, 231, 255), font=small_font)

            cur_y = y + header_h + 8
            for col in table_meta[table]["columns"]:
                cname = col["name"]
                ctype = str(col["type"]).lower()
                is_pk = cname in table_meta[table]["pks"]
                is_fk = cname in table_meta[table]["fks"]

                if is_pk:
                    draw.rectangle([x + 10, cur_y, x + 38, cur_y + 16], fill=(254, 240, 138))
                    draw.text((x + 14, cur_y + 1), "PK", fill=(133, 77, 14), font=small_font)
                elif is_fk:
                    draw.rectangle([x + 10, cur_y, x + 38, cur_y + 16], fill=(224, 231, 255))
                    draw.text((x + 14, cur_y + 1), "FK", fill=(67, 56, 202), font=small_font)
                else:
                    draw.ellipse([x + 22, cur_y + 5, x + 28, cur_y + 11], fill=(203, 213, 225))

                draw.text((x + 46, cur_y), cname, fill=(15, 23, 42), font=row_font)
                draw.text((x + w - 120, cur_y + 2), ctype[:15], fill=(100, 116, 139), font=small_font)
                cur_y += row_h

        # Connecting Lines
        for table, meta in table_meta.items():
            src_pos = coords[table]
            for local_col, (ref_table, ref_col) in meta["fks"].items():
                if ref_table in coords:
                    dst_pos = coords[ref_table]
                    if src_pos["x"] < dst_pos["x"]:
                        start_pt = (src_pos["x"] + src_pos["w"], src_pos["y"] + header_h + 20)
                        end_pt = (dst_pos["x"], dst_pos["y"] + header_h + 20)
                    else:
                        start_pt = (src_pos["x"], src_pos["y"] + header_h + 20)
                        end_pt = (dst_pos["x"] + dst_pos["w"], dst_pos["y"] + header_h + 20)

                    mid_x = (start_pt[0] + end_pt[0]) // 2
                    draw.line([start_pt, (mid_x, start_pt[1]), (mid_x, end_pt[1]), end_pt], fill=(99, 102, 241), width=2)
                    arrow_x = end_pt[0]
                    arrow_y = end_pt[1]
                    sign = 1 if start_pt[0] < end_pt[0] else -1
                    draw.polygon([(arrow_x, arrow_y), (arrow_x - 8 * sign, arrow_y - 5), (arrow_x - 8 * sign, arrow_y + 5)], fill=(99, 102, 241))

        # Bottom Footer Banner
        footer_top = canvas_h - footer_banner_h
        draw.rectangle([0, footer_top, canvas_w, canvas_h], fill=(30, 41, 59))
        draw.text((30, footer_top + 16), FOOTER_COPYRIGHT, fill=(241, 245, 249), font=footer_font)
        draw.text((canvas_w - 240, footer_top + 16), FOOTER_DEVELOPER, fill=(199, 210, 254), font=footer_font)

        img.save(output_path, "PNG")
        print(f"[SUCCESS] Exported high-resolution ER Diagram to: {os.path.abspath(output_path)}")


def handle_offline_schema_view():
    """Allows viewing table schema definitions and exporting diagram even if offline."""
    if not HAS_MODELS:
        print("[!] Model definitions could not be loaded.")
        input("\nPress Enter to return...")
        return

    print("\n" + "=" * 70)
    print(f" {APP_NAME} - PRE-DEFINED POSTGRESQL TABLE SCHEMAS")
    print("=" * 70)
    for model in [User, DBFile, DBProcessedFile, DBProcessingJob]:
        print(f"\nTABLE: {model.__tablename__}")
        print("-" * 50)
        col_headers = ["Column Name", "Type", "Nullable", "Key"]
        col_rows = []
        for col in model.__table__.columns:
            pk = "PRIMARY KEY" if col.primary_key else ""
            fk = f"FK -> {list(col.foreign_keys)[0].target_fullname}" if col.foreign_keys else ""
            key_str = pk or fk or "-"
            col_rows.append([col.name, str(col.type), "YES" if col.nullable else "NO", key_str])
        print_table(col_headers, col_rows, max_col_width=35)

    print("\n[Options]:")
    print("  [E] Export ER Diagram (.png) and SQL Schema (.sql)")
    print("  [B] Back to Main Menu")
    c = input("\nEnter option: ").strip().lower()
    if c == "e":
        try:
            from sqlalchemy import create_engine as create_mem_engine
            mem_engine = create_mem_engine("sqlite:///:memory:")
            Base.metadata.create_all(mem_engine)
            mem_viewer = DatabaseViewer("sqlite:///:memory:")
            mem_viewer.engine = mem_engine
            mem_viewer.inspector = inspect(mem_engine)
            mem_viewer.export_er_diagram("database_diagram.png")
            mem_viewer.export_sql_schema("database_schema.sql")
            print("[SUCCESS] Diagram and schema exported successfully!")
        except Exception as ex:
            print(f"[ERROR] Export failed: {ex}")
        input("\nPress Enter to continue...")


def main():
    while True:
        print("\n" + "=" * 65)
        print(f"      {APP_NAME} - PostgreSQL Database Viewer")
        print(f"      \"{APP_TAGLINE}\"")
        print("=" * 65)

        db_url = os.getenv("DATABASE_URL", "").strip()
        if not db_url:
            print("\n[!] No DATABASE_URL found in environment or .env file.")
            print("    Please set DATABASE_URL in backend/.env or enter it below.")
            print("\n[Options]:")
            print("  [1] Enter DATABASE_URL now")
            print("  [2] View ClearMark table schema definitions (Offline)")
            print("  [Q] Exit")
            opt = input("\nEnter choice: ").strip().lower()
            if opt == "1":
                entered_url = input("\nEnter DATABASE_URL: ").strip()
                if entered_url:
                    save_env_database_url(entered_url)
                    continue
            elif opt == "2":
                handle_offline_schema_view()
                continue
            else:
                print_footer()
                break

        viewer = DatabaseViewer(db_url)
        print(f"[*] Target Database : {viewer.info.get('database')}")
        print(f"[*] Host             : {viewer.info.get('host')}:{viewer.info.get('port')}")
        print(f"[*] User             : {viewer.info.get('username')}")
        print(f"[*] Connection URL   : {viewer.info.get('masked_url')}")
        print("[*] Connecting...")

        if not viewer.connect():
            print("\n" + "=" * 65)
            print(" [DATABASE CONNECTION NOTICE]")
            print("=" * 65)
            print(f" Target Host: {viewer.info.get('host')}:{viewer.info.get('port')}")
            print(f" Database:    {viewer.info.get('database')}")
            print(f" User:        {viewer.info.get('username')}")
            print(f" Details:     {viewer.last_error}\n")

            print("[Interactive Options]:")
            print("  [1] Enter / update your Neon PostgreSQL password")
            print("  [2] Enter a new full DATABASE_URL")
            print("  [3] Retry connection")
            print("  [4] View ClearMark table schemas & export diagram/SQL (Offline)")
            print("  [Q] Exit")

            choice = input("\nEnter selection: ").strip().lower()
            if choice == "1":
                pwd = input("\nEnter your real Neon PostgreSQL password: ").strip()
                if pwd:
                    new_url = update_password_in_url(db_url, pwd)
                    save_env_database_url(new_url)
                    print("[✓] Password updated in .env! Re-connecting...\n")
                    continue
            elif choice == "2":
                new_full_url = input("\nEnter new DATABASE_URL: ").strip()
                if new_full_url:
                    save_env_database_url(new_full_url)
                    print("[✓] DATABASE_URL updated in .env! Re-connecting...\n")
                    continue
            elif choice == "3":
                continue
            elif choice == "4":
                handle_offline_schema_view()
                continue
            else:
                print("\nExiting Database Viewer.")
                print_footer()
                break

        # Connected successfully!
        print("[SUCCESS] Successfully connected to PostgreSQL!\n")

        session_active = True
        while session_active:
            tables = viewer.get_tables()
            if not tables:
                print("\n[INFO] No tables exist in this PostgreSQL database yet.")
                print("[Options]:")
                if HAS_MODELS:
                    print("  [I] Initialize / Create ClearMark tables (users, files, processed_files, processing_jobs)")
                print("  [R] Refresh")
                print("  [Q] Back / Exit")
                sub_opt = input("\nEnter selection: ").strip().lower()
                if sub_opt == "i" and HAS_MODELS:
                    try:
                        Base.metadata.create_all(viewer.engine)
                        print("[SUCCESS] All ClearMark tables created successfully in PostgreSQL!")
                        continue
                    except Exception as ex:
                        print(f"[ERROR] Failed to create tables: {ex}")
                elif sub_opt == "r":
                    continue
                else:
                    session_active = False
                    break

            print("\n" + "=" * 55)
            print(" DETECTED TABLES IN DATABASE")
            print("=" * 55)
            summary_rows = []
            for idx, tbl in enumerate(tables, start=1):
                count = viewer.get_record_count(tbl)
                summary_rows.append([str(idx), tbl, str(count)])

            print_table(["#", "Table Name", "Records"], summary_rows)

            print("\n[Options]:")
            print("  [1-" + str(len(tables)) + "] View Table Records & Data (with Pagination)")
            print("  [S]   View Complete Database Schema & Foreign Keys")
            print("  [E]   Export ER Diagram (.png) & SQL Schema (.sql)")
            print("  [R]   Refresh Table Counts")
            print("  [Q]   Exit")

            print_footer()
            cmd = input("\nEnter selection: ").strip().lower()

            if cmd in ("q", "exit"):
                print("\nExiting Database Viewer.")
                print_footer()
                return
            elif cmd == "s":
                viewer.print_schema()
            elif cmd == "e":
                print("\nGenerating exports...")
                viewer.export_er_diagram("database_diagram.png")
                viewer.export_sql_schema("database_schema.sql")
                print_footer()
                input("\nPress Enter to return to menu...")
            elif cmd == "r":
                print("Refreshing...")
                continue
            elif cmd.isdigit():
                idx = int(cmd)
                if 1 <= idx <= len(tables):
                    selected_table = tables[idx - 1]
                    viewer.view_table_paginated(selected_table)
                else:
                    print("[!] Invalid table number.")
            else:
                print("[!] Unrecognized option.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nProcess interrupted by user. Exiting.")
        print_footer()
