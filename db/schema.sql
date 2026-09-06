-- Online MCQ Test Website Database Schema
CREATE DATABASE IF NOT EXISTS `mcq_test_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `mcq_test_db`;

-- Users Table (Students & Admins)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('student', 'admin') DEFAULT 'student',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Subjects / Categories Table
CREATE TABLE IF NOT EXISTS `subjects` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `description` TEXT,
  `icon` VARCHAR(50) DEFAULT 'book-open',
  `color` VARCHAR(20) DEFAULT '#4f46e5',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tests Table
CREATE TABLE IF NOT EXISTS `tests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `subject_id` INT NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT,
  `duration_minutes` INT NOT NULL DEFAULT 10,
  `total_marks` INT NOT NULL DEFAULT 10,
  `passing_percentage` DECIMAL(5,2) DEFAULT 40.00,
  `is_published` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Questions Table (Strictly 4 Options)
CREATE TABLE IF NOT EXISTS `questions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `test_id` INT NOT NULL,
  `question_text` TEXT NOT NULL,
  `option_a` TEXT NOT NULL,
  `option_b` TEXT NOT NULL,
  `option_c` TEXT NOT NULL,
  `option_d` TEXT NOT NULL,
  `correct_option` ENUM('A', 'B', 'C', 'D') NOT NULL,
  `marks` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`test_id`) REFERENCES `tests`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Test Attempts Table (Student Submissions)
CREATE TABLE IF NOT EXISTS `test_attempts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `test_id` INT NOT NULL,
  `total_questions` INT NOT NULL DEFAULT 0,
  `correct_answers` INT NOT NULL DEFAULT 0,
  `wrong_answers` INT NOT NULL DEFAULT 0,
  `unanswered_questions` INT NOT NULL DEFAULT 0,
  `score` DECIMAL(7,2) NOT NULL DEFAULT 0.00,
  `total_marks` DECIMAL(7,2) NOT NULL DEFAULT 0.00,
  `percentage` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('passed', 'failed') NOT NULL DEFAULT 'failed',
  `started_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `submitted_at` TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`test_id`) REFERENCES `tests`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Student Answers Breakdown Table
CREATE TABLE IF NOT EXISTS `student_answers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `attempt_id` INT NOT NULL,
  `question_id` INT NOT NULL,
  `selected_option` ENUM('A', 'B', 'C', 'D') NULL,
  `is_correct` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`attempt_id`) REFERENCES `test_attempts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
