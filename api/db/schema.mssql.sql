IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
CREATE TABLE users (
  id INT IDENTITY(1,1) PRIMARY KEY,
  username NVARCHAR(50) NOT NULL UNIQUE,
  password_hash NVARCHAR(255) NOT NULL,
  display_name NVARCHAR(100) NOT NULL DEFAULT '',
  role NVARCHAR(30) NOT NULL DEFAULT 'viewer',
  active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'company')
CREATE TABLE company (
  id INT NOT NULL PRIMARY KEY DEFAULT 1,
  name NVARCHAR(200) NOT NULL DEFAULT '',
  name_en NVARCHAR(200) NOT NULL DEFAULT '',
  phone NVARCHAR(50) NOT NULL DEFAULT '',
  address NVARCHAR(MAX) NOT NULL DEFAULT '',
  taxno NVARCHAR(50) NOT NULL DEFAULT '',
  CONSTRAINT CK_company_single CHECK (id = 1)
);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'app_seq')
CREATE TABLE app_seq (
  id INT NOT NULL PRIMARY KEY DEFAULT 1,
  emp INT NOT NULL DEFAULT 0,
  htr INT NOT NULL DEFAULT 0,
  vac INT NOT NULL DEFAULT 0,
  prod INT NOT NULL DEFAULT 0,
  mov INT NOT NULL DEFAULT 0,
  quote INT NOT NULL DEFAULT 78,
  CONSTRAINT CK_app_seq_single CHECK (id = 1)
);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'app_settings')
CREATE TABLE app_settings (
  id INT NOT NULL PRIMARY KEY DEFAULT 1,
  quote_default_terms NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  CONSTRAINT CK_app_settings_single CHECK (id = 1)
);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'employees')
CREATE TABLE employees (
  id NVARCHAR(10) NOT NULL PRIMARY KEY,
  name NVARCHAR(100) NOT NULL,
  phone NVARCHAR(30) NOT NULL DEFAULT '',
  salary DECIMAL(12, 2) NOT NULL DEFAULT 0,
  opening DECIMAL(12, 2) NOT NULL DEFAULT 0,
  active BIT NOT NULL DEFAULT 1
);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'htrans')
CREATE TABLE htrans (
  id NVARCHAR(20) NOT NULL PRIMARY KEY,
  emp_id NVARCHAR(10) NOT NULL,
  date DATE NULL,
  type NVARCHAR(20) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  hours DECIMAL(8, 2) NULL,
  desc_text NVARCHAR(MAX) NOT NULL DEFAULT '',
  paid BIT NOT NULL DEFAULT 0,
  CONSTRAINT FK_htrans_emp FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'vacations')
CREATE TABLE vacations (
  id NVARCHAR(20) NOT NULL PRIMARY KEY,
  emp_id NVARCHAR(10) NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason NVARCHAR(MAX) NOT NULL DEFAULT '',
  settled BIT NOT NULL DEFAULT 0,
  CONSTRAINT FK_vacations_emp FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'products')
CREATE TABLE products (
  id NVARCHAR(10) NOT NULL PRIMARY KEY,
  name NVARCHAR(200) NOT NULL,
  open_prod DECIMAL(12, 2) NOT NULL DEFAULT 0,
  open_draw DECIMAL(12, 2) NOT NULL DEFAULT 0
);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'moves')
CREATE TABLE moves (
  id NVARCHAR(20) NOT NULL PRIMARY KEY,
  prod_id NVARCHAR(10) NOT NULL,
  date DATE NULL,
  type NVARCHAR(10) NOT NULL,
  qty DECIMAL(12, 2) NOT NULL DEFAULT 0,
  desc_text NVARCHAR(MAX) NOT NULL DEFAULT '',
  CONSTRAINT FK_moves_prod FOREIGN KEY (prod_id) REFERENCES products(id) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_htrans_emp')
CREATE INDEX idx_htrans_emp ON htrans(emp_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_vacations_emp')
CREATE INDEX idx_vacations_emp ON vacations(emp_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_moves_prod')
CREATE INDEX idx_moves_prod ON moves(prod_id);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'quotes')
CREATE TABLE quotes (
  quote_number INT NOT NULL PRIMARY KEY,
  data NVARCHAR(MAX) NOT NULL DEFAULT '{}',
  saved_at DATETIME2 NULL,
  saved_by NVARCHAR(50) NOT NULL DEFAULT ''
);
