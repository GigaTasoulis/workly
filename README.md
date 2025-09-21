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

`npm install --legacy-peer-deps`

3. Configure Next.js for Static Export
   Ensure your next.config.mjs is configured to export static files. An example configuration is:

```
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  assetPrefix: '/', // Use "/" as required by next/font
  images: {
    unoptimized: true,
  },
  // Other configuration options...
};

export default nextConfig;
```

4. Build the Static Export
   Generate your static files in the out folder by running:
   ` npm run build`

5. Package the Electron App
   Make sure your package.json contains the necessary scripts and build configuration. An example section in package.json is:

```{
  "name": "my-v0-project",
  "version": "0.1.0",
  "main": "main.js",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "build:electron": "npm run build && electron-builder"
  },
  "build": {
    "appId": "com.example.myapp",
    "productName": "Workly",
    "files": [
      "out/**",
      "main.js",
      "preload.js",
      "package.json"
    ],
    "directories": {
      "buildResources": "assets"
    },
    "mac": {
      "target": "dmg"
    },
    "win": {
      "target": "nsis"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

Then package your app by running:
`npm run build:electron`

6. Run the Packaged Application
   After packaging, run the installer or launch the app directly from the dist folder to verify everything works correctly.

Development
For development, you can run the Next.js dev server and Electron separately:

Start the Next.js Dev Server:

```
npm run dev
```

Launch Electron:

Open another terminal window and run:

```
npx electron .
```

License
This project is licensed under the MIT License.

Contact
For support or questions, please contact me at tasgiannak2001@gmail.com
`This file uses proper Markdown formatting with headings, code blocks, and bullet lists to make it easy to follow. Adjust any paths, commands, or descriptions to match your project's specifics. Let me know if you need any further changes!`
