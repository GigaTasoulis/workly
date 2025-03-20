# Workly – Business Management Application

Workly is a fully offline business management application built using Next.js and Electron. It runs entirely on your local machine so that your data never leaves your system.

## Features

- Manage customers, suppliers, employees, and workplaces.
- Interactive dashboards with charts and recent activities.
- Complete offline operation with no external web dependencies.

## System Requirements

- **Operating System:** Windows, macOS, or Linux.
- **For Packaged Installer:** No additional software is required.
- **For Running from Source:** Node.js (v14+ recommended) and npm.

## Installation

There are two ways to install and run Workly:

### Option 1: Using the Packaged Installer (Recommended)

1. **Download the Installer:**
   - Visit the [Releases](#) page on our Git repository.
   - Download the installer for your operating system (e.g., `.exe` for Windows, `.dmg` for macOS, or `.AppImage` for Linux).

2. **Install the Application:**
   - Run the downloaded installer and follow the on-screen instructions.
   - Once installed, launch Workly like any other desktop application.

### Option 2: Running from Source (For Developers / Advanced Users)

If you prefer to build and run the app from source, follow these steps:

#### 1. Clone the Repository

```
git clone https://github.com/yourusername/workly.git
cd workly
```

2. Install Dependencies
Install all required dependencies using the legacy-peer-deps flag (to bypass dependency conflicts):

```npm install --legacy-peer-deps```

3. Configure Next.js for Static Export
Ensure your next.config.mjs is configured to export static files. An example configuration is:
