-- GB CarSys 2.0 database schema
-- MySQL 5.7+ / MariaDB 10.3+  (import with phpMyAdmin or: mysql -u root gbcars < schema.sql)
-- Table and column names are kept compatible with the old CarSYS 1.13 database (admin_carsys)
-- so old data can be imported directly with database/migrate.php.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `tb_company` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `manager` varchar(100) DEFAULT NULL,
  `address` text,
  `province` varchar(100) DEFAULT NULL,
  `tel` varchar(100) DEFAULT NULL,
  `fax` varchar(100) DEFAULT NULL,
  `en1` text, `en2` text, `en3` text, `en4` text, `en5` text,
  `webheader` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_faculty` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(20) DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_depart` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `faculty_id` int(11) DEFAULT NULL,
  `code` varchar(20) DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `faculty_id` (`faculty_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_province` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(20) DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `prov_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_brand` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_cartype` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_oil` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `price` decimal(8,2) DEFAULT '0.00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_insurer` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `address` text,
  `tel` varchar(200) DEFAULT NULL,
  `fax` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_leasing` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `address` text,
  `tel` varchar(200) DEFAULT NULL,
  `fax` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_garage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `garage_type` smallint(2) DEFAULT '0',
  `name` varchar(100) DEFAULT NULL,
  `address` text,
  `tel` varchar(200) DEFAULT NULL,
  `fax` varchar(50) DEFAULT NULL,
  `comment` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_docprefix` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `docname` varchar(50) DEFAULT NULL,
  `prefix` varchar(5) DEFAULT NULL,
  `numlimit` smallint(6) DEFAULT NULL,
  `tbname` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tbname` (`tbname`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `member_type` smallint(2) DEFAULT '0' COMMENT '0=user, 1=admin',
  `code` varchar(20) DEFAULT NULL,
  `title` varchar(20) DEFAULT NULL,
  `firstname` varchar(50) DEFAULT NULL,
  `surname` varchar(50) DEFAULT NULL,
  `nickname` varchar(20) DEFAULT NULL,
  `depart_id` int(11) DEFAULT NULL,
  `position_name` varchar(100) DEFAULT NULL,
  `tel` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `status` smallint(2) DEFAULT '0' COMMENT '0=active, 1=suspended',
  `username` varchar(50) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL COMMENT 'bcrypt; legacy md5 upgraded on login',
  `date_last_login` date DEFAULT NULL,
  `time_last_login` varchar(10) DEFAULT NULL,
  `picture1` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `username` (`username`),
  KEY `depart_id` (`depart_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_userdepart` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `depart_id` int(11) DEFAULT NULL,
  `test1` int(11) NOT NULL DEFAULT '0',
  `test2` varchar(50) DEFAULT NULL,
  `test3` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `depart_id` (`depart_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_driver` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(20) DEFAULT NULL,
  `title` varchar(20) DEFAULT NULL,
  `firstname` varchar(50) DEFAULT NULL,
  `surname` varchar(50) DEFAULT NULL,
  `nickname` varchar(20) DEFAULT NULL,
  `idcard` varchar(20) DEFAULT NULL,
  `datef` date DEFAULT NULL,
  `datet` date DEFAULT NULL,
  `status` smallint(2) DEFAULT '0' COMMENT '0=normal, 1=not allowed to drive',
  `comment` text,
  `picture1` varchar(50) DEFAULT NULL,
  `tel` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_car` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(20) DEFAULT NULL COMMENT 'license plate',
  `prov_code` varchar(10) DEFAULT NULL,
  `prov_name` varchar(100) DEFAULT NULL,
  `carno` varchar(20) DEFAULT NULL,
  `cartype_id` int(11) DEFAULT NULL,
  `brand_id` int(11) DEFAULT NULL,
  `oil_id` int(11) DEFAULT NULL,
  `model` text,
  `power` text,
  `color` varchar(100) DEFAULT NULL,
  `machine_no` varchar(100) DEFAULT NULL,
  `machine_tank` varchar(100) DEFAULT NULL,
  `price` int(11) DEFAULT NULL,
  `date_buy` date DEFAULT NULL,
  `date_in` date DEFAULT NULL,
  `date_f_code` date DEFAULT NULL,
  `date_e_code` date DEFAULT NULL,
  `date_f_cpi` date DEFAULT NULL,
  `date_e_cpi` date DEFAULT NULL,
  `date_f_insure` date DEFAULT NULL,
  `date_e_insure` date DEFAULT NULL,
  `insurer_id` int(11) DEFAULT NULL,
  `picture1` varchar(50) DEFAULT NULL,
  `picture2` varchar(50) DEFAULT NULL,
  `picture3` varchar(50) DEFAULT NULL,
  `picture4` varchar(50) DEFAULT NULL,
  `picture5` varchar(50) DEFAULT NULL,
  `status` smallint(2) DEFAULT '0' COMMENT '0=normal,1=repair,2=paused,3=retired',
  `comment` text,
  `rate` float DEFAULT '0' COMMENT 'baht per minute',
  `seats` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `code` (`code`),
  KEY `status` (`status`),
  KEY `date_e_code` (`date_e_code`),
  KEY `date_e_cpi` (`date_e_cpi`),
  KEY `date_e_insure` (`date_e_insure`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_carfile` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `car_id` int(11) DEFAULT NULL,
  `oldfilename` varchar(255) DEFAULT NULL,
  `filename` varchar(50) DEFAULT NULL,
  `path` text,
  `comment` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `car_id` (`car_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_booking` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `docno` varchar(20) DEFAULT NULL,
  `docdate` date DEFAULT NULL,
  `doctime` varchar(8) DEFAULT NULL,
  `docref` varchar(20) DEFAULT NULL,
  `car_id` int(11) DEFAULT NULL,
  `status` smallint(2) DEFAULT '0' COMMENT '0=wait,1=read,2=approved,3=rejected,4=cancelled,5=returned,6=received',
  `driver_id` int(11) DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `working` text,
  `address` varchar(100) DEFAULT NULL,
  `tumbol` varchar(100) DEFAULT NULL,
  `aumphur` varchar(100) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `passenger_amount` smallint(4) DEFAULT NULL,
  `passenger_name` text,
  `depart_id` int(11) DEFAULT NULL,
  `person_name` varchar(100) DEFAULT NULL,
  `tel` varchar(100) DEFAULT NULL,
  `comment` text,
  `user_save_id` int(11) DEFAULT NULL,
  `date_create` datetime DEFAULT NULL,
  `date_edit` datetime DEFAULT NULL,
  `read_date` datetime DEFAULT NULL,
  `approve_date` datetime DEFAULT NULL,
  `approve_comment` text,
  `save_status` smallint(6) DEFAULT '0',
  `user_approve_id` int(11) DEFAULT NULL,
  `car_rate` float DEFAULT '0',
  `car_money` float DEFAULT '0',
  `discount` float DEFAULT '0',
  `date_return` datetime DEFAULT NULL,
  `date_return_ok` datetime DEFAULT NULL,
  `damage` float DEFAULT '0',
  `return_comment` text,
  `user_return_id` int(11) DEFAULT NULL,
  `file1` varchar(50) DEFAULT NULL,
  `file1_name` text,
  `file2` varchar(50) DEFAULT NULL,
  `file2_name` text,
  PRIMARY KEY (`id`),
  KEY `docno` (`docno`),
  KEY `car_period` (`car_id`,`start_date`,`end_date`),
  KEY `depart_status` (`depart_id`,`status`),
  KEY `user_save_id` (`user_save_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_carwork` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `docno` varchar(20) DEFAULT NULL,
  `docdate` date DEFAULT NULL,
  `doctime` varchar(8) DEFAULT NULL,
  `booking` smallint(6) DEFAULT '0',
  `booking_id` int(11) DEFAULT NULL,
  `car_id` int(11) DEFAULT NULL,
  `docref` varchar(255) DEFAULT NULL,
  `working` varchar(250) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `start_time` varchar(8) DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `end_time` varchar(8) DEFAULT NULL,
  `start_km` int(11) DEFAULT NULL,
  `end_km` int(11) DEFAULT NULL,
  `depart_id` int(11) DEFAULT NULL,
  `person_name` varchar(100) DEFAULT NULL,
  `driver_id` int(11) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `aumphur` varchar(100) DEFAULT NULL,
  `tumbol` varchar(100) DEFAULT NULL,
  `amount_oil` float DEFAULT NULL,
  `oil_rate` float DEFAULT NULL,
  `pay_outcome` int(11) DEFAULT NULL,
  `outcome_comment` text,
  `pay_income` int(11) DEFAULT NULL,
  `income_comment` text,
  `work_comment` text,
  `user_save_id` int(11) DEFAULT NULL,
  `date_create` datetime DEFAULT NULL,
  `date_edit` datetime DEFAULT NULL,
  `tel` varchar(100) DEFAULT NULL,
  `passenger_amount` smallint(4) DEFAULT NULL,
  `passenger_name` text,
  `status` smallint(6) DEFAULT '0',
  `car_rate` float DEFAULT '0',
  `car_money` float DEFAULT '0',
  `discount` float DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `car_id` (`car_id`),
  KEY `booking_id` (`booking_id`),
  KEY `start_date` (`start_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_carfix` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `docno` varchar(20) DEFAULT NULL,
  `car_id` int(11) DEFAULT NULL,
  `docref` varchar(20) DEFAULT NULL,
  `datefix` date DEFAULT NULL,
  `dateprocess` date DEFAULT NULL,
  `km` int(11) DEFAULT NULL,
  `garage_id` int(11) DEFAULT NULL,
  `datecomplete` date DEFAULT NULL,
  `depart_id` int(11) DEFAULT NULL,
  `person_name` varchar(100) DEFAULT NULL,
  `comment` text,
  `user_save_id` int(11) DEFAULT NULL,
  `date_create` datetime DEFAULT NULL,
  `date_edit` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `car_id` (`car_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_carfix_sub` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `carfix_id` int(11) DEFAULT NULL,
  `item` varchar(200) DEFAULT NULL,
  `unitname` varchar(50) DEFAULT NULL,
  `qty` float DEFAULT '0',
  `price` float DEFAULT '0',
  `comment` text,
  PRIMARY KEY (`id`),
  KEY `carfix_id` (`carfix_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_insurance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `car_id` int(11) DEFAULT NULL,
  `docno` varchar(20) DEFAULT NULL,
  `docdate` date DEFAULT NULL,
  `insurer_id` int(11) DEFAULT NULL,
  `insurance_no` varchar(50) DEFAULT NULL,
  `insurance_type` varchar(50) DEFAULT NULL,
  `datef` date DEFAULT NULL,
  `datee` date DEFAULT NULL,
  `price` float DEFAULT NULL,
  `amount` float DEFAULT NULL,
  `person_name` varchar(100) DEFAULT NULL,
  `comment` text,
  `user_save_id` int(11) DEFAULT NULL,
  `date_create` datetime DEFAULT NULL,
  `date_edit` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `car_id` (`car_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_tabian` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `car_id` int(11) DEFAULT NULL,
  `docno` varchar(20) DEFAULT NULL,
  `docdate` date DEFAULT NULL,
  `datef` date DEFAULT NULL,
  `datee` date DEFAULT NULL,
  `price` float DEFAULT NULL,
  `price_other` float DEFAULT NULL,
  `person_name` varchar(100) DEFAULT NULL,
  `comment` text,
  `user_save_id` int(11) DEFAULT NULL,
  `date_create` datetime DEFAULT NULL,
  `date_edit` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `car_id` (`car_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_plb` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `car_id` int(11) DEFAULT NULL,
  `docno` varchar(20) DEFAULT NULL,
  `docdate` date DEFAULT NULL,
  `datef` date DEFAULT NULL,
  `datee` date DEFAULT NULL,
  `price` float DEFAULT NULL,
  `person_name` varchar(100) DEFAULT NULL,
  `comment` text,
  `user_save_id` int(11) DEFAULT NULL,
  `date_create` datetime DEFAULT NULL,
  `date_edit` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `car_id` (`car_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tb_payleasing` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `car_id` int(11) DEFAULT NULL,
  `docno` varchar(20) DEFAULT NULL,
  `docdate` date DEFAULT NULL,
  `leasing_id` int(11) DEFAULT NULL,
  `doc_leasing` varchar(50) DEFAULT NULL,
  `docref` varchar(50) DEFAULT NULL,
  `datef` date DEFAULT NULL,
  `no` smallint(4) DEFAULT NULL,
  `price` float DEFAULT NULL,
  `person_name` varchar(255) DEFAULT NULL,
  `comment` text,
  `user_save_id` int(11) DEFAULT NULL,
  `date_create` datetime DEFAULT NULL,
  `date_edit` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `car_id` (`car_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Login throttling (new in 2.0)
CREATE TABLE IF NOT EXISTS `tb_login_attempt` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ip` varchar(45) NOT NULL,
  `username` varchar(50) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ip_time` (`ip`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Default document number prefixes (same as CarSYS 1.13)
INSERT INTO `tb_docprefix` (`id`, `docname`, `prefix`, `numlimit`, `tbname`) VALUES
(1, 'เอกสารการจอง', 'REV', 4, 'tb_booking'),
(2, 'เอกสารการใช้รถ', 'USE', 4, 'tb_carwork'),
(3, 'เอกสารการซ่อมบำรุง', 'MAN', 4, 'tb_carfix'),
(4, 'เอกสารชำระเบี้ยประกันภัย', 'INS', 4, 'tb_insurance'),
(5, 'เอกสารการต่อทะเบียน', 'TAB', 4, 'tb_tabian'),
(6, 'เอกสารการต่อ พรบ.', 'PLB', 4, 'tb_plb'),
(7, 'เอกสารการชำระค่างวด', 'INV', 4, 'tb_payleasing')
ON DUPLICATE KEY UPDATE `id` = `id`;

INSERT INTO `tb_company` (`id`, `name`, `webheader`) VALUES (1, 'บริษัทของฉัน', 'GB CarSys')
ON DUPLICATE KEY UPDATE `id` = `id`;
