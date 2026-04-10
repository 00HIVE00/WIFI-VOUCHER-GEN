import { useState } from 'react'
import jsPDF from 'jspdf'
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, PageBreak, ImageRun } from 'docx'
import { saveAs } from 'file-saver'
import QRCode from 'qrcode'

const PAPER_SIZES = {
  a4: { width: 210, height: 297, name: 'A4' },
  letter: { width: 216, height: 279, name: 'Letter (US)' },
  legal: { width: 216, height: 356, name: 'Legal (US)' },
  a3: { width: 297, height: 420, name: 'A3' },
  a5: { width: 148, height: 210, name: 'A5' }
}

function ExportPDF({
  voucherCodes,
  backgroundImage,
  textPosition,
  textStyle,
  layoutSettings: externalLayoutSettings,
  onLayoutChange,
  imageTransform = { left: 0, top: 0, scaleX: 1, scaleY: 1 },
  qrCodePosition = { x: 50, y: 50 },
  qrCodeSize = 60
}) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState('pdf') // 'pdf' or 'word'
  const [imageQuality, setImageQuality] = useState(0.75) // JPEG quality (0-1)
  
  // Use external layout settings if provided, otherwise use internal state
  const [internalLayoutSettings, setInternalLayoutSettings] = useState({
    paperSize: 'a4',
    columns: 2,
    rows: 5,
    margin: 5,
    spacing: 2
  })
  
  const layoutSettings = externalLayoutSettings || internalLayoutSettings
  const setLayoutSettings = onLayoutChange || setInternalLayoutSettings

  const createVoucherImage = async (code, useJPEG = false, quality = 0.75) => {
    return new Promise(async (resolve) => {
      // Reduced resolution for smaller file size (400x300 instead of 800x600)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = 400
      canvas.height = 300

      // Fill canvas with white background first (prevents black background in PDF)
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const img = new Image()
      img.crossOrigin = 'anonymous' // Handle CORS if needed
      img.onload = async () => {
        const baseScale = Math.min(
          canvas.width / img.width,
          canvas.height / img.height
        )
        
        // Apply image transform (position and scale)
        const finalScaleX = baseScale * (imageTransform.scaleX || 1)
        const finalScaleY = baseScale * (imageTransform.scaleY || 1)
        const imgWidth = img.width * finalScaleX
        const imgHeight = img.height * finalScaleY
        
        // Calculate image position (convert from 800x600 canvas coordinates)
        const imgX = imageTransform.left !== undefined && imageTransform.left !== 0
          ? (imageTransform.left * canvas.width) / 800
          : (canvas.width - imgWidth) / 2
        const imgY = imageTransform.top !== undefined && imageTransform.top !== 0
          ? (imageTransform.top * canvas.height) / 600
          : (canvas.height - imgHeight) / 2
        
        // Draw background image
        ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight)

        // Generate QR code for the voucher code
        try {
          const qrCodeDataUrl = await QRCode.toDataURL(code, {
            width: 80,
            margin: 1,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          })
          
          const qrImg = new Image()
          qrImg.onload = () => {
            // Draw QR code at the configured position (scaled from 800x600 canvas to 400x300)
            const qrSize = (qrCodeSize * canvas.width) / 800
            const qrX = (qrCodePosition.x * canvas.width) / 800
            const qrY = (qrCodePosition.y * canvas.height) / 600
            ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)
            
            // Draw voucher code text (scaled down proportionally)
            const fontSize = (textStyle.fontSize * canvas.width) / 800
            ctx.font = `${textStyle.fontWeight} ${fontSize}px Arial`
            ctx.fillStyle = textStyle.color
            ctx.textAlign = 'left'
            ctx.textBaseline = 'top'
            const textX = (textPosition.x * canvas.width) / 800
            const textY = (textPosition.y * canvas.height) / 600
            ctx.fillText(code, textX, textY)

            // Use JPEG for smaller file size, PNG for preview
            if (useJPEG) {
              resolve(canvas.toDataURL('image/jpeg', quality))
            } else {
              resolve(canvas.toDataURL('image/png'))
            }
          }
          qrImg.src = qrCodeDataUrl
        } catch (error) {
          console.error('Error generating QR code:', error)
          // If QR code fails, just draw the text
          const fontSize = (textStyle.fontSize * canvas.width) / 800
          ctx.font = `${textStyle.fontWeight} ${fontSize}px Arial`
          ctx.fillStyle = textStyle.color
          ctx.textAlign = 'left'
          ctx.textBaseline = 'top'
          const textX = (textPosition.x * canvas.width) / 800
          const textY = (textPosition.y * canvas.height) / 600
          ctx.fillText(code, textX, textY)

          if (useJPEG) {
            resolve(canvas.toDataURL('image/jpeg', quality))
          } else {
            resolve(canvas.toDataURL('image/png'))
          }
        }
      }
      img.src = backgroundImage
    })
  }


  const exportToPDF = async () => {
    if (!backgroundImage || voucherCodes.length === 0) {
      alert('Please upload a background image and voucher codes first.')
      return
    }

    setIsExporting(true)

    try {
      const paper = PAPER_SIZES[layoutSettings.paperSize]
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [paper.width, paper.height],
        compress: true
      })

      // Set PDF margins to 0 since we're calculating positions manually
      pdf.setProperties({
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      })

      const { columns: cols, rows, margin, spacing } = layoutSettings
      
      // Calculate usable area (total page size minus margins on all sides)
      const usableWidth = paper.width - (margin * 2)
      const usableHeight = paper.height - (margin * 2)
      
      // Calculate voucher size: usable area minus spacing between vouchers, divided by number of vouchers
      // Formula: (total usable width - spacing between items) / number of items
      const voucherWidth = cols > 1 
        ? (usableWidth - (spacing * (cols - 1))) / cols
        : usableWidth
      const voucherHeight = rows > 1
        ? (usableHeight - (spacing * (rows - 1))) / rows
        : usableHeight

      let voucherIndex = 0

      for (const code of voucherCodes) {
        // Create new page if needed
        if (voucherIndex > 0 && voucherIndex % (cols * rows) === 0) {
          pdf.addPage()
        }

        const positionInPage = voucherIndex % (cols * rows)
        const col = positionInPage % cols
        const row = Math.floor(positionInPage / cols)

        // Calculate position with proper margins and spacing
        // For each column: start at margin, add (column index * voucher width) + (column index * spacing)
        // For each row: start at margin, add (row index * voucher height) + (row index * spacing)
        const x = margin + (col * (voucherWidth + spacing))
        const y = margin + (row * (voucherHeight + spacing))

        // Create voucher image with JPEG compression for smaller file size
        const imgData = await createVoucherImage(code, true, imageQuality)
        
        // Add to PDF (using JPEG format for compression)
        pdf.addImage(
          imgData,
          'JPEG',
          x,
          y,
          voucherWidth,
          voucherHeight
        )

        voucherIndex++
      }

      // Save PDF
      pdf.save('unifi-vouchers.pdf')
      setIsExporting(false)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Error exporting PDF: ' + error.message)
      setIsExporting(false)
    }
  }

  const exportToWord = async () => {
    if (!backgroundImage || voucherCodes.length === 0) {
      alert('Please upload a background image and voucher codes first.')
      return
    }

    setIsExporting(true)

    try {
      // Use same calculations as PDF
      const paper = PAPER_SIZES[layoutSettings.paperSize]
      const { columns: cols, rows, margin, spacing } = layoutSettings
      const usableWidth = paper.width - (margin * 2)
      const usableHeight = paper.height - (margin * 2)
      
      const voucherWidth = (usableWidth - (spacing * (cols - 1))) / cols
      const voucherHeight = (usableHeight - (spacing * (rows - 1))) / rows

      // Convert mm to EMUs (English Metric Units) - Word uses EMUs: 1mm = 36000 EMUs
      const mmToEmu = 36000
      const imageWidthEmu = Math.round(voucherWidth * mmToEmu)
      const imageHeightEmu = Math.round(voucherHeight * mmToEmu)

      const vouchersPerPage = cols * rows
      const children = []

      for (let i = 0; i < voucherCodes.length; i += vouchersPerPage) {
        const pageVouchers = voucherCodes.slice(i, i + vouchersPerPage)
        
        // Create a table for this page
        const tableRows = []
        
        for (let row = 0; row < rows; row++) {
          const cells = []
          for (let col = 0; col < cols; col++) {
            const voucherIndex = row * cols + col
            const code = pageVouchers[voucherIndex]
            
            if (code) {
              // Create voucher image (use PNG for Word to ensure compatibility)
              const imgData = await createVoucherImage(code, false) // Use PNG format for Word
              
              // Convert base64 to buffer properly
              const base64Data = imgData.split(',')[1]
              const binaryString = atob(base64Data)
              const bytes = new Uint8Array(binaryString.length)
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j)
              }
              
              // Spacing in twentieths of a point (for cell margins)
              // 1mm = 2.83465 points, 1 point = 20 twentieths
              const mmToPoints = 2.83465
              const pointsToTwentieths = 20
              const spacingTwentieths = Math.round(spacing * mmToPoints * pointsToTwentieths)
              
              // Create table cell with image using ImageRun
              cells.push(
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new ImageRun({
                          data: bytes,
                          transformation: {
                            width: imageWidthEmu,
                            height: imageHeightEmu
                          }
                        })
                      ],
                      alignment: AlignmentType.CENTER
                    })
                  ],
                  width: {
                    size: 100 / cols,
                    type: WidthType.PERCENTAGE
                  },
                  margins: {
                    top: spacingTwentieths / 2,
                    bottom: spacingTwentieths / 2,
                    left: spacingTwentieths / 2,
                    right: spacingTwentieths / 2
                  },
                  verticalAlign: 'center'
                })
              )
            } else {
              // Empty cell
              cells.push(
                new TableCell({
                  children: [new Paragraph('')],
                  width: {
                    size: 100 / cols,
                    type: WidthType.PERCENTAGE
                  }
                })
              )
            }
          }
          tableRows.push(new TableRow({ 
            children: cells
          }))
        }
        
        const table = new Table({
          rows: tableRows,
          width: {
            size: 100,
            type: WidthType.PERCENTAGE
          }
        })
        
        children.push(table)
        
        // Add page break if not last page
        if (i + vouchersPerPage < voucherCodes.length) {
          children.push(new Paragraph({ children: [new PageBreak()] }))
        }
      }

      // Create document with section
      // Use standard page size format for docx library
      // Convert mm to points: 1mm = 2.83465 points, then to twentieths: 1 point = 20 twentieths
      const mmToPoints = 2.83465
      const pointsToTwentieths = 20
      const pageWidthTwentieths = Math.round(paper.width * mmToPoints * pointsToTwentieths)
      const pageHeightTwentieths = Math.round(paper.height * mmToPoints * pointsToTwentieths)
      const marginTwentieths = Math.round(margin * mmToPoints * pointsToTwentieths)
      
      const doc = new Document({
        creator: 'UniFi Voucher Designer',
        title: 'UniFi Vouchers',
        description: 'Generated voucher codes',
        sections: [{
          properties: {
            page: {
              size: {
                width: pageWidthTwentieths,
                height: pageHeightTwentieths
              },
              margin: {
                top: marginTwentieths,
                bottom: marginTwentieths,
                left: marginTwentieths,
                right: marginTwentieths
              }
            }
          },
          children: children.length > 0 ? children : [new Paragraph('')] // Ensure at least one child
        }]
      })

      const blob = await Packer.toBlob(doc)
      saveAs(blob, 'unifi-vouchers.docx')
      setIsExporting(false)
    } catch (error) {
      console.error('Error exporting Word:', error)
      alert('Error exporting Word document: ' + error.message)
      setIsExporting(false)
    }
  }

  const handleExport = () => {
    if (exportFormat === 'pdf') {
      exportToPDF()
    } else {
      exportToWord()
    }
  }

  const vouchersPerPage = layoutSettings.columns * layoutSettings.rows
  const totalPages = Math.ceil(voucherCodes.length / vouchersPerPage)

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-semibold mb-4">Export Vouchers</h2>
      
      <div className="space-y-4">
        {/* Export Format Selection */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Export Format
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setExportFormat('pdf')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
                exportFormat === 'pdf'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              PDF
            </button>
            <button
              onClick={() => setExportFormat('word')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
                exportFormat === 'word'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Word (.docx)
            </button>
          </div>
        </div>

        {/* Image Quality (PDF only) */}
        {exportFormat === 'pdf' && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Image Quality: {Math.round(imageQuality * 100)}% 
              <span className="text-xs text-gray-500 ml-2">(Lower = Smaller file)</span>
            </label>
            <input
              type="range"
              min="0.3"
              max="1.0"
              step="0.05"
              value={imageQuality}
              onChange={(e) => setImageQuality(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Smaller (30%)</span>
              <span>Balanced (75%)</span>
              <span>Larger (100%)</span>
            </div>
          </div>
        )}
        {/* Paper Size */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Paper Size
          </label>
          <select
            value={layoutSettings.paperSize}
            onChange={(e) => setLayoutSettings({ ...layoutSettings, paperSize: e.target.value })}
            className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {Object.entries(PAPER_SIZES).map(([key, size]) => (
              <option key={key} value={key}>
                {size.name} ({size.width}mm × {size.height}mm)
              </option>
            ))}
          </select>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Columns
            </label>
            <input
              type="number"
              min="1"
              max="5"
              value={layoutSettings.columns}
              onChange={(e) => setLayoutSettings({ ...layoutSettings, columns: parseInt(e.target.value) || 1 })}
              className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Rows
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={layoutSettings.rows}
              onChange={(e) => setLayoutSettings({ ...layoutSettings, rows: parseInt(e.target.value) || 1 })}
              className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Margins and Spacing */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Margin (mm)
            </label>
            <input
              type="number"
              min="0"
              max="20"
              step="0.5"
              value={layoutSettings.margin}
              onChange={(e) => setLayoutSettings({ ...layoutSettings, margin: parseFloat(e.target.value) || 0 })}
              className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Spacing (mm)
            </label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.5"
              value={layoutSettings.spacing}
              onChange={(e) => setLayoutSettings({ ...layoutSettings, spacing: parseFloat(e.target.value) || 0 })}
              className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleExport}
            disabled={isExporting || !backgroundImage || voucherCodes.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {isExporting 
              ? 'Exporting...' 
              : exportFormat === 'pdf' 
                ? 'Export to PDF' 
                : 'Export to Word'}
          </button>
        </div>

        {/* Info */}
        <div className="text-sm text-gray-400 space-y-1 pt-2 border-t border-gray-700">
          <p>📄 Layout: {layoutSettings.columns}×{layoutSettings.rows} grid per page</p>
          <p>📊 Total vouchers: {voucherCodes.length}</p>
          <p>📑 Estimated pages: {totalPages}</p>
          <p>📏 Voucher size: ~{((PAPER_SIZES[layoutSettings.paperSize].width - (layoutSettings.margin * 2) - (layoutSettings.spacing * (layoutSettings.columns - 1))) / layoutSettings.columns).toFixed(1)}mm × ~{((PAPER_SIZES[layoutSettings.paperSize].height - (layoutSettings.margin * 2) - (layoutSettings.spacing * (layoutSettings.rows - 1))) / layoutSettings.rows).toFixed(1)}mm</p>
        </div>
      </div>
    </div>
  )
}

export default ExportPDF

