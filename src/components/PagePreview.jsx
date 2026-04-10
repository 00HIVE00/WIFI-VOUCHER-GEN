import { useState, useEffect, useRef } from 'react'
import { fabric } from 'fabric'
import QRCode from 'qrcode'

const PAPER_SIZES = {
  a4: { width: 210, height: 297, name: 'A4' },
  letter: { width: 216, height: 279, name: 'Letter (US)' },
  legal: { width: 216, height: 356, name: 'Legal (US)' },
  a3: { width: 297, height: 420, name: 'A3' },
  a5: { width: 148, height: 210, name: 'A5' }
}

function PagePreview({
  voucherCodes,
  backgroundImage,
  textPosition,
  onPositionChange,
  textStyle,
  onStyleChange,
  layoutSettings,
  imageTransform: externalImageTransform,
  onImageTransformChange,
  qrCodePosition = { x: 50, y: 50 },
  onQrCodePositionChange,
  qrCodeSize = 60,
  onQrCodeSizeChange
}) {
  const [previewVouchers, setPreviewVouchers] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGridEditor, setShowGridEditor] = useState(false)
  const canvasRef = useRef(null)
  const canvasWrapRef = useRef(null)
  const fabricCanvasRef = useRef(null)
  const gridCanvasRef = useRef(null)
  const gridFabricCanvasRef = useRef(null)
  const textObjectRef = useRef(null)
  const imageObjectRef = useRef(null)
  const qrCodeObjectRef = useRef(null)
  const voucherImagesRef = useRef([]) // Store individual voucher image objects
  const [voucherPositions, setVoucherPositions] = useState({}) // Store positions for each voucher
  
  // Use external image transform if provided, otherwise use internal state
  const [internalImageTransform, setInternalImageTransform] = useState({
    left: 0,
    top: 0,
    scaleX: 1,
    scaleY: 1
  })
  
  const imageTransform = externalImageTransform || internalImageTransform
  const setImageTransform = onImageTransformChange || setInternalImageTransform

  const EDIT_BASE_W = 400
  const EDIT_BASE_H = 300

  const fitEditorCanvasToContainer = () => {
    const canvas = fabricCanvasRef.current
    const wrap = canvasWrapRef.current
    if (!canvas || !wrap) return

    const rect = wrap.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))

    canvas.setWidth(w)
    canvas.setHeight(h)

    const zoom = Math.min(w / EDIT_BASE_W, h / EDIT_BASE_H)
    canvas.setViewportTransform([zoom, 0, 0, zoom, 0, 0])

    const offsetX = (w - EDIT_BASE_W * zoom) / 2
    const offsetY = (h - EDIT_BASE_H * zoom) / 2
    const vpt = canvas.viewportTransform
    vpt[4] = offsetX
    vpt[5] = offsetY
    canvas.setViewportTransform(vpt)

    canvas.requestRenderAll()
  }

  // Generate preview of first page
  const generatePagePreview = async () => {
    if (!backgroundImage || voucherCodes.length === 0) return

    setIsGenerating(true)
    const { columns: cols, rows } = layoutSettings
    const vouchersPerPage = cols * rows
    const pageVouchers = voucherCodes.slice(0, vouchersPerPage)

    const vouchers = []
    for (const code of pageVouchers) {
      const img = await createVoucherImage(code)
      vouchers.push({ code, image: img })
    }

    setPreviewVouchers(vouchers)
    setIsGenerating(false)
  }

  const createVoucherImage = async (code) => {
    return new Promise(async (resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = 400
      canvas.height = 300

      // Fill canvas with white background first
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const img = new Image()
      img.crossOrigin = 'anonymous' // Handle CORS if needed
      img.onload = async () => {
        // Use image transform from canvas if available
        const baseScale = Math.min(
          canvas.width / img.width,
          canvas.height / img.height
        )
        
        // Apply user's image transform
        const finalScaleX = baseScale * (imageTransform.scaleX || 1)
        const finalScaleY = baseScale * (imageTransform.scaleY || 1)
        const imgWidth = img.width * finalScaleX
        const imgHeight = img.height * finalScaleY
        
        // Calculate image position (convert from canvas coordinates)
        const imgX = imageTransform.left !== undefined 
          ? (imageTransform.left * canvas.width) / 400
          : (canvas.width - imgWidth) / 2
        const imgY = imageTransform.top !== undefined
          ? (imageTransform.top * canvas.height) / 300
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
            
            // Get current text size from canvas if available
            const currentFontSize = textObjectRef.current 
              ? (textObjectRef.current.fontSize * 800) / 400
              : textStyle.fontSize
            
            const fontSize = (currentFontSize * canvas.width) / 800
            ctx.font = `${textStyle.fontWeight} ${fontSize}px Arial`
            ctx.fillStyle = textStyle.color
            ctx.textAlign = 'left'
            ctx.textBaseline = 'top'
            
            // Get current text position from canvas
            const textX = textObjectRef.current
              ? (textObjectRef.current.left * canvas.width) / 400
              : (textPosition.x * canvas.width) / 800
            const textY = textObjectRef.current
              ? (textObjectRef.current.top * canvas.height) / 300
              : (textPosition.y * canvas.height) / 600
            ctx.fillText(code, textX, textY)

            resolve(canvas.toDataURL('image/png'))
          }
          qrImg.src = qrCodeDataUrl
        } catch (error) {
          console.error('Error generating QR code:', error)
          // If QR code fails, just draw the text
          const currentFontSize = textObjectRef.current 
            ? (textObjectRef.current.fontSize * 800) / 400
            : textStyle.fontSize
          
          const fontSize = (currentFontSize * canvas.width) / 800
          ctx.font = `${textStyle.fontWeight} ${fontSize}px Arial`
          ctx.fillStyle = textStyle.color
          ctx.textAlign = 'left'
          ctx.textBaseline = 'top'
          
          const textX = textObjectRef.current
            ? (textObjectRef.current.left * canvas.width) / 400
            : (textPosition.x * canvas.width) / 800
          const textY = textObjectRef.current
            ? (textObjectRef.current.top * canvas.height) / 300
            : (textPosition.y * canvas.height) / 600
          ctx.fillText(code, textX, textY)

          resolve(canvas.toDataURL('image/png'))
        }
      }
      img.src = backgroundImage
    })
  }

  // Initialize Fabric.js canvas for editing
  useEffect(() => {
    if (!canvasRef.current || !backgroundImage) return

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: EDIT_BASE_W,
      height: EDIT_BASE_H,
      backgroundColor: '#1f2937'
    })

    fabricCanvasRef.current = canvas
    fitEditorCanvasToContainer()

    // Load background image - make it editable
    fabric.Image.fromURL(backgroundImage, (img) => {
      const baseScale = Math.min(canvas.width / img.width, canvas.height / img.height)
      
      // Calculate initial position (center if no transform exists)
      const initialScaleX = imageTransform.scaleX && imageTransform.scaleX !== 1 
        ? baseScale * imageTransform.scaleX 
        : baseScale
      const initialScaleY = imageTransform.scaleY && imageTransform.scaleY !== 1
        ? baseScale * imageTransform.scaleY
        : baseScale
      
      const imgWidth = img.width * initialScaleX
      const imgHeight = img.height * initialScaleY
      
      const imgLeft = imageTransform.left !== undefined && imageTransform.left !== 0
        ? (imageTransform.left * 400) / 800
        : (canvas.width - imgWidth) / 2
      const imgTop = imageTransform.top !== undefined && imageTransform.top !== 0
        ? (imageTransform.top * 300) / 600
        : (canvas.height - imgHeight) / 2
      
      img.set({
        left: imgLeft,
        top: imgTop,
        scaleX: initialScaleX,
        scaleY: initialScaleY,
        selectable: true,
        hasControls: true,
        hasBorders: true,
        lockRotation: true, // Prevent rotation
        lockScalingFlip: true // Prevent flipping
      })
      
      imageObjectRef.current = img
      canvas.insertAt(img, 0)
      
      // Update image transform when moved/resized
      img.on('modified', () => {
        const newTransform = {
          left: (img.left * 800) / 400,
          top: (img.top * 600) / 300,
          scaleX: img.scaleX / baseScale,
          scaleY: img.scaleY / baseScale
        }
        setImageTransform(newTransform)
        // Regenerate preview
        if (voucherCodes.length > 0) {
          generatePagePreview()
        }
      })

      // Create editable text
      const text = new fabric.Text(voucherCodes[0] || 'VOUCHER-CODE', {
        left: (textPosition.x * canvas.width) / 800,
        top: (textPosition.y * canvas.height) / 600,
        fontSize: (textStyle.fontSize * canvas.width) / 800,
        fill: textStyle.color,
        fontWeight: textStyle.fontWeight,
        fontFamily: 'Arial',
        selectable: true,
        hasControls: true,
        hasBorders: true
      })

      textObjectRef.current = text
      canvas.add(text)

      // Update position and size when dragged/resized
      text.on('modified', () => {
        const newX = (text.left * 800) / canvas.width
        const newY = (text.top * 600) / canvas.height
        onPositionChange({ x: newX, y: newY })
        
        // Update font size if text was resized
        const newFontSize = (text.fontSize * 800) / 400
        if (Math.abs(newFontSize - textStyle.fontSize) > 1) {
          onStyleChange({
            ...textStyle,
            fontSize: newFontSize
          })
        }
        
        // Regenerate preview
        if (voucherCodes.length > 0) {
          generatePagePreview()
        }
      })
      
      // Also update on scaling (resizing)
      text.on('scaling', () => {
        const newFontSize = (text.fontSize * text.scaleX * 800) / 400
        onStyleChange({
          ...textStyle,
          fontSize: newFontSize
        })
      })

      canvas.renderAll()
      
    })

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => fitEditorCanvasToContainer())
    })
    if (canvasWrapRef.current) ro.observe(canvasWrapRef.current)

    return () => {
      ro.disconnect()
      canvas.dispose()
    }
  }, [backgroundImage])

  // Add/update QR code when voucher codes are available
  useEffect(() => {
    if (!fabricCanvasRef.current || !backgroundImage) {
      // Remove QR code if canvas or background not ready
      if (qrCodeObjectRef.current && fabricCanvasRef.current) {
        fabricCanvasRef.current.remove(qrCodeObjectRef.current)
        qrCodeObjectRef.current = null
        fabricCanvasRef.current.renderAll()
      }
      return
    }

    if (!voucherCodes || voucherCodes.length === 0) {
      // Remove QR code if no voucher codes
      if (qrCodeObjectRef.current && fabricCanvasRef.current) {
        fabricCanvasRef.current.remove(qrCodeObjectRef.current)
        qrCodeObjectRef.current = null
        fabricCanvasRef.current.renderAll()
      }
      return
    }

    const canvas = fabricCanvasRef.current

    // Remove existing QR code if any
    if (qrCodeObjectRef.current) {
      canvas.remove(qrCodeObjectRef.current)
      qrCodeObjectRef.current = null
    }

    // Generate and add QR code (with error handling)
    try {
      QRCode.toDataURL(voucherCodes[0], {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }).then((qrCodeDataUrl) => {
        if (!fabricCanvasRef.current) return
        
        fabric.Image.fromURL(qrCodeDataUrl, (qrImg) => {
          if (!fabricCanvasRef.current) return
          
          const canvas = fabricCanvasRef.current
          // Scale QR code to match the configured size
          const qrSize = (qrCodeSize * canvas.width) / 800
          const qrScale = qrSize / qrImg.width
          
          qrImg.set({
            left: (qrCodePosition.x * canvas.width) / 800,
            top: (qrCodePosition.y * canvas.height) / 600,
            scaleX: qrScale,
            scaleY: qrScale,
            selectable: true,
            hasControls: true,
            hasBorders: true,
            lockRotation: true,
            lockUniScaling: false
          })
          
          qrCodeObjectRef.current = qrImg
          canvas.add(qrImg)
          
          // Update QR code position when moved
          qrImg.on('modified', () => {
            const newX = (qrImg.left * 800) / canvas.width
            const newY = (qrImg.top * 600) / canvas.height
            if (onQrCodePositionChange) {
              onQrCodePositionChange({ x: newX, y: newY })
            }
            
            // Update size if resized
            const newSize = Math.min(qrImg.width * qrImg.scaleX, qrImg.height * qrImg.scaleY) * 800 / canvas.width
            if (onQrCodeSizeChange && Math.abs(newSize - qrCodeSize) > 1) {
              onQrCodeSizeChange(newSize)
            }
          })
          
          // Also update on moving (real-time position update)
          qrImg.on('moving', () => {
            const newX = (qrImg.left * 800) / canvas.width
            const newY = (qrImg.top * 600) / canvas.height
            if (onQrCodePositionChange) {
              onQrCodePositionChange({ x: newX, y: newY })
            }
          })
          
          // Update on scaling
          qrImg.on('scaling', () => {
            const newSize = Math.min(qrImg.width * qrImg.scaleX, qrImg.height * qrImg.scaleY) * 800 / canvas.width
            if (onQrCodeSizeChange) {
              onQrCodeSizeChange(newSize)
            }
          })
          
          canvas.renderAll()
        }, { crossOrigin: 'anonymous' })
      }).catch((error) => {
        console.error('Error generating QR code for preview:', error)
      })
    } catch (error) {
      console.error('Error in QR code generation:', error)
    }
  }, [voucherCodes?.length, qrCodePosition?.x, qrCodePosition?.y, qrCodeSize, backgroundImage])

  // Update text style
  useEffect(() => {
    if (textObjectRef.current && fabricCanvasRef.current) {
      textObjectRef.current.set({
        fontSize: (textStyle.fontSize * 400) / 800,
        fill: textStyle.color,
        fontWeight: textStyle.fontWeight
      })
      fabricCanvasRef.current.renderAll()
    }
  }, [textStyle])

  // Update QR code position
  useEffect(() => {
    if (qrCodeObjectRef.current && fabricCanvasRef.current) {
      const qrImg = qrCodeObjectRef.current
      const currentX = Math.round((qrImg.left * 800) / 400)
      const currentY = Math.round((qrImg.top * 600) / 300)
      const newX = Math.round(qrCodePosition.x)
      const newY = Math.round(qrCodePosition.y)
      
      if ((Math.abs(currentX - newX) > 1 || Math.abs(currentY - newY) > 1) && !qrImg.isMoving) {
        qrImg.set({
          left: (qrCodePosition.x * 400) / 800,
          top: (qrCodePosition.y * 300) / 600
        })
        fabricCanvasRef.current.renderAll()
      }
    }
  }, [qrCodePosition.x, qrCodePosition.y])

  // Update QR code size
  useEffect(() => {
    if (qrCodeObjectRef.current && fabricCanvasRef.current) {
      const qrImg = qrCodeObjectRef.current
      if (!qrImg.isMoving && !qrImg.isSelected) {
        const currentSize = Math.min(qrImg.width * qrImg.scaleX, qrImg.height * qrImg.scaleY) * 800 / 400
        if (Math.abs(currentSize - qrCodeSize) > 1) {
          const newScale = (qrCodeSize * 400) / (800 * Math.min(qrImg.width, qrImg.height))
          qrImg.set({
            scaleX: newScale,
            scaleY: newScale
          })
          fabricCanvasRef.current.renderAll()
        }
      }
    }
  }, [qrCodeSize])

  // Update text position
  useEffect(() => {
    if (textObjectRef.current && fabricCanvasRef.current) {
      textObjectRef.current.set({
        left: (textPosition.x * 400) / 800,
        top: (textPosition.y * 300) / 600
      })
      if (voucherCodes.length > 0) {
        textObjectRef.current.set('text', voucherCodes[0])
      }
      fabricCanvasRef.current.renderAll()
    }
  }, [textPosition.x, textPosition.y, voucherCodes])

  // Initialize grid editor canvas
  useEffect(() => {
    if (!showGridEditor || previewVouchers.length === 0) {
      if (gridFabricCanvasRef.current) {
        gridFabricCanvasRef.current.dispose()
        gridFabricCanvasRef.current = null
        voucherImagesRef.current = []
      }
      return
    }

    // Wait a bit for DOM to be ready
    const timer = setTimeout(() => {
      if (!gridCanvasRef.current) return

      const { columns: cols, rows } = layoutSettings
      const paper = PAPER_SIZES[layoutSettings.paperSize] || { width: 210, height: 297 }
      
      // Calculate scale to make it larger and more visible (700px wide)
      const containerWidth = 700
      const scale = containerWidth / paper.width
      const canvasWidth = paper.width * scale
      const canvasHeight = paper.height * scale

      // Set canvas element size
      gridCanvasRef.current.width = canvasWidth
      gridCanvasRef.current.height = canvasHeight
      gridCanvasRef.current.style.width = `${canvasWidth}px`
      gridCanvasRef.current.style.height = `${canvasHeight}px`

      const canvas = new fabric.Canvas(gridCanvasRef.current, {
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: '#ffffff'
      })

      gridFabricCanvasRef.current = canvas

      // Calculate grid cell size
      const cellWidth = canvasWidth / cols
      const cellHeight = canvasHeight / rows

      // Load each voucher image as editable Fabric.js image
      let loadedCount = 0
      previewVouchers.forEach((voucher, index) => {
        const col = index % cols
        const row = Math.floor(index / cols)
        
        fabric.Image.fromURL(voucher.image, (img) => {
          // Use saved position or default grid position
          const savedPos = voucherPositions[voucher.code]
          const defaultX = col * cellWidth + (cellWidth - img.width * 0.8) / 2
          const defaultY = row * cellHeight + (cellHeight - img.height * 0.8) / 2
          
          // Calculate scale to fit in cell
          const scaleToFit = Math.min(cellWidth * 0.9 / img.width, cellHeight * 0.9 / img.height)
          
          img.set({
            left: savedPos?.x !== undefined ? savedPos.x * scale : defaultX,
            top: savedPos?.y !== undefined ? savedPos.y * scale : defaultY,
            scaleX: savedPos?.scaleX !== undefined ? savedPos.scaleX : scaleToFit,
            scaleY: savedPos?.scaleY !== undefined ? savedPos.scaleY : scaleToFit,
            selectable: true,
            hasControls: true,
            hasBorders: true,
            lockRotation: true,
            lockScalingFlip: true
          })

          // Store reference
          voucherImagesRef.current[index] = img
          canvas.add(img)
          loadedCount++

          // Update position when moved/resized
          img.on('modified', () => {
            setVoucherPositions(prev => ({
              ...prev,
              [voucher.code]: {
                x: img.left / scale,
                y: img.top / scale,
                scaleX: img.scaleX,
                scaleY: img.scaleY,
                width: img.width * img.scaleX / scale,
                height: img.height * img.scaleY / scale
              }
            }))
          })

          if (loadedCount === previewVouchers.length) {
            canvas.renderAll()
          }
        }, { crossOrigin: 'anonymous' })
      })
    }, 150)

    return () => {
      clearTimeout(timer)
      if (gridFabricCanvasRef.current) {
        gridFabricCanvasRef.current.dispose()
        gridFabricCanvasRef.current = null
        voucherImagesRef.current = []
      }
    }
  }, [showGridEditor, previewVouchers, layoutSettings])

  // Auto-generate preview when settings change
  useEffect(() => {
    if (backgroundImage && voucherCodes.length > 0) {
      generatePagePreview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundImage, voucherCodes.length, textPosition.x, textPosition.y, textStyle.color, textStyle.fontSize, textStyle.fontWeight, layoutSettings.columns, layoutSettings.rows])

  const { columns: cols, rows } = layoutSettings
  const vouchersPerPage = cols * rows
  const totalPages = Math.ceil(voucherCodes.length / vouchersPerPage)

  const handleToggleGridEditor = () => {
    // Ensure we have a fresh preview before opening the grid editor
    if (!showGridEditor && (!previewVouchers || previewVouchers.length === 0)) {
      generatePagePreview()
    }
    setShowGridEditor(!showGridEditor)
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 h-full min-h-0 flex flex-col">
      <h2 className="text-xl font-semibold mb-3 shrink-0">Page Preview & Editor</h2>
      
      <div className="space-y-3 min-h-0 flex-1 flex flex-col">
        {/* Editable Canvas */}
        <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 min-h-0 flex flex-col">
          <p className="text-sm text-gray-400 mb-2">
            Edit Voucher Design (Drag to move, resize handles to adjust size)
          </p>
          <div ref={canvasWrapRef} className="flex-1 min-h-0">
            <canvas ref={canvasRef} className="w-full h-full rounded" />
          </div>
          <div className="text-xs text-gray-500 mt-2 space-y-1 shrink-0">
            <p className="text-center">
              Text Position: X: {Math.round(textPosition.x)}, Y: {Math.round(textPosition.y)} | 
              Size: {Math.round(textStyle.fontSize)}px
            </p>
            <p className="text-center">
              Image Scale: {Math.round((imageTransform.scaleX || 1) * 100)}% | 
              Position: X: {Math.round(imageTransform.left || 0)}, Y: {Math.round(imageTransform.top || 0)}
            </p>
            <p className="text-center text-gray-600 text-[10px]">
              💡 Click and drag image or text to move. Use corner handles to resize.
            </p>
          </div>
        </div>

        {/* Page Layout Preview */}
        {previewVouchers.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold text-gray-300">
                Page 1 Preview ({cols}×{rows} grid)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleToggleGridEditor}
                  className="text-xs bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-white"
                >
                  {showGridEditor ? 'View Mode' : 'Edit Grid'}
                </button>
                <button
                  onClick={generatePagePreview}
                  disabled={isGenerating}
                  className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 px-3 py-1 rounded text-white"
                >
                  {isGenerating ? 'Generating...' : 'Refresh'}
                </button>
              </div>
            </div>
            
            {showGridEditor ? (
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                <div className="mb-3">
                  <p className="text-sm text-gray-300 font-semibold mb-1 text-center">
                    Grid Editor - Move & Resize Each Voucher
                  </p>
                  <p className="text-xs text-gray-400 text-center">
                    Click and drag each voucher to move, use corner handles to resize
                  </p>
                </div>
                <div className="flex justify-center overflow-auto bg-white p-2 rounded border-2 border-blue-500">
                  <canvas 
                    ref={gridCanvasRef} 
                    className="border-2 border-gray-400 rounded bg-white shadow-lg"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      generatePagePreview()
                      setShowGridEditor(false)
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg text-white font-semibold text-sm shadow-lg"
                  >
                    💾 Save Layout & Exit
                  </button>
                  <button
                    onClick={() => setShowGridEditor(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-3 rounded-lg text-white font-semibold text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div 
                className="bg-white p-4 rounded-lg border border-gray-700"
                style={{
                  aspectRatio: `${layoutSettings.paperSize === 'a4' ? '210/297' : '216/279'}`
                }}
              >
                <div 
                  className="grid gap-1 h-full"
                  style={{
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`
                  }}
                >
                  {previewVouchers.map((item, index) => (
                    <div key={index} className="border border-gray-300 rounded overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.code}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="text-xs text-gray-400 mt-2 space-y-1">
              <p>📄 Showing first {previewVouchers.length} vouchers of {voucherCodes.length} total</p>
              <p>📑 Total pages: {totalPages}</p>
              <p>💡 Click "Edit Grid" to move and resize individual vouchers</p>
            </div>
          </div>
        )}

        {voucherCodes.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-8">
            Upload voucher codes and background image to see preview
          </div>
        )}
      </div>
    </div>
  )
}

export default PagePreview

