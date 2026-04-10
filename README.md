# UniFi Voucher Designer

A web-based application for designing and generating professional UniFi voucher codes with custom backgrounds and styling.

## Features

- **CSV Upload**: Upload a CSV file containing UniFi voucher codes (10-digit format: 00000-00000)
- **Design Canvas**: Visual editor with Fabric.js for positioning voucher codes on background images
- **Styling Tools**: Customize font color, size, and weight
- **Batch Preview**: Preview all vouchers before export
- **PDF Export**: Generate high-quality PDFs with 2x5 grid layout per A4 page

## Tech Stack

- **Frontend**: React.js with Vite
- **Graphics**: Fabric.js for canvas manipulation
- **PDF Generation**: jsPDF
- **CSV Parsing**: PapaParse
- **Styling**: Tailwind CSS (Dark Mode)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`)

## Usage

1. **Upload Voucher Codes**: Click "Upload Voucher Codes" and select a CSV file containing your codes (format: 00000-00000)

2. **Upload Background Image**: In the Design Canvas, upload a JPG or PNG image to use as the background

3. **Position Text**: Drag the text box on the canvas to position where the voucher code will appear

4. **Style Text**: Use the styling controls to adjust font size, weight, and color

5. **Preview**: Click "Generate Preview" to see how your vouchers will look

6. **Export**: Click "Export to PDF" to generate a PDF file with all vouchers (2x5 grid per page)

## CSV Format

Your CSV file should contain voucher codes in the format `00000-00000` or `0000000000` (with or without dash). Example:

```
12345-67890
23456-78901
34567-89012
```

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── CSVUpload.jsx       # CSV file upload component
│   │   ├── DesignCanvas.jsx    # Fabric.js canvas with image and text
│   │   ├── StylingControls.jsx # Font styling controls
│   │   ├── BatchPreview.jsx    # Preview generation
│   │   └── ExportPDF.jsx       # PDF export functionality
│   ├── App.jsx                 # Main application component
│   ├── main.jsx                # React entry point
│   └── index.css               # Tailwind CSS imports
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## License

MIT

