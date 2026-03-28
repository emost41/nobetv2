# Automated Shift Scheduling App

## Project Overview
This is a web-based, mobile-responsive automated shift scheduling application built with React and Vite. It allows companies to manage staff, set scheduling constraints, and automatically generate fair monthly schedules.

## Features
- **Staff Management**: Add, edit, and delete staff members with priority and seniority levels.
- **Constraints**: Configure daily staff needs, shift durations, and monthly limits.
- **Automated Scheduling**: Heuristic algorithm to generate fair schedules.
- **Statistics**: View detailed stats on shifts and hours per employee.
- **Export**: Download schedules as PDF or CSV.

## How to Run

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Start Development Server**
    ```bash
    npm run dev
    ```

3.  **Open in Browser**
    The terminal will show a local URL (usually `http://localhost:5173`). Open this link in your browser.

## Tech Stack
- React
- Vite
- date-fns
- jspdf / jspdf-autotable
