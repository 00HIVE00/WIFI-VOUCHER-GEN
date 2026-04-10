import { useEffect, useRef, useState } from 'react'
import { fabric } from 'fabric'

function DesignCanvas({
  backgroundImage,
  onImageUpload,
  textPosition,
  onPositionChange,
  textStyle,
  voucherCodes,
  qrCodePosition,
  onQrCodePositionChange,
  qrCodeSize,
  onQrCodeSizeChange
}) {
  const canvasRef = useRef(null)
  const canvasWrapRef = useRef(null)
  const fileInputRef = useRef(null)
  const fabricCanvasRef = useRef(null)
  const textObjectRef = useRef(null)
  const qrCodeObjectRef = useRef(null)
  const bgObjectRef = useRef(null)

  const BASE_W = 800
  const BASE_H = 600

  const fitCanvasToContainer = () => {
    const canvas = fabricCanvasRef.current
    const wrap = canvasWrapRef.current
    if (!canvas || !wrap) return

    const rect = wrap.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))

    // Resize the HTML canvas to match the container
    canvas.setWidth(w)
    canvas.setHeight(h)

    // Zoom to fit BASE_W x BASE_H into the container
    const zoom = Math.min(w / BASE_W, h / BASE_H)
    canvas.setViewportTransform([zoom, 0, 0, zoom, 0, 0])

    // Center the base canvas within the container
    const offsetX = (w - BASE_W * zoom) / 2
    const offsetY = (h - BASE_H * zoom) / 2
    const vpt = canvas.viewportTransform
    vpt[4] = offsetX
    vpt[5] = offsetY
    canvas.setViewportTransform(vpt)

    canvas.requestRenderAll()
  }

  // Initialize canvas and create text object
  useEffect(() => {
    if (!canvasRef.current) return

    // Initialize Fabric.js canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: BASE_W,
      height: BASE_H,
      backgroundColor: '#1f2937'
    })

    fabricCanvasRef.current = canvas
    fitCanvasToContainer()

    // Create text object
    const text = new fabric.Text('VOUCHER-CODE', {
      left: textPosition.x,
      top: textPosition.y,
      fontSize: textStyle.fontSize,
      fill: textStyle.color,
      fontWeight: textStyle.fontWeight,
      fontFamily: 'Arial',
      selectable: true,
      hasControls: true,
      hasBorders: true
    })

    textObjectRef.current = text
    canvas.add(text)

    // Update text position when dragged
    text.on('modified', () => {
      onPositionChange({
        x: text.left,
        y: text.top
      })
    })

    // Also update on moving (real-time position update)
    text.on('moving', () => {
      onPositionChange({
        x: text.left,
        y: text.top
      })
    })

    // Create QR code placeholder (white box)
    const qrPlaceholder = new fabric.Rect({
      left: qrCodePosition.x,
      top: qrCodePosition.y,
      width: qrCodeSize,
      height: qrCodeSize,
      fill: 'rgba(255, 255, 255, 0.9)',
      stroke: '#3b82f6',
      strokeWidth: 2,
      strokeDashArray: [5, 5],
      selectable: true,
      hasControls: true,
      hasBorders: true,
      lockRotation: true,
      lockUniScaling: false // Allow independent width/height scaling
    })

    qrCodeObjectRef.current = qrPlaceholder
    canvas.add(qrPlaceholder)

    // Update QR code position when dragged
    qrPlaceholder.on('modified', () => {
      onQrCodePositionChange({
        x: qrPlaceholder.left,
        y: qrPlaceholder.top
      })
      onQrCodeSizeChange(Math.min(qrPlaceholder.width * qrPlaceholder.scaleX, qrPlaceholder.height * qrPlaceholder.scaleY))
    })

    // Also update on moving (real-time position update)
    qrPlaceholder.on('moving', () => {
      onQrCodePositionChange({
        x: qrPlaceholder.left,
        y: qrPlaceholder.top
      })
    })

    // Update on scaling
    qrPlaceholder.on('scaling', () => {
      onQrCodeSizeChange(Math.min(qrPlaceholder.width * qrPlaceholder.scaleX, qrPlaceholder.height * qrPlaceholder.scaleY))
    })

    // Load background image if available
    if (backgroundImage) {
      fabric.Image.fromURL(backgroundImage, (img) => {
        // Scale image to fit canvas while maintaining aspect ratio
        const scale = Math.min(
          BASE_W / img.width,
          BASE_H / img.height
        )
        img.scale(scale)
        img.set({
          left: (BASE_W - img.width * scale) / 2,
          top: (BASE_H - img.height * scale) / 2,
          selectable: false,
          evented: false
        })
        bgObjectRef.current = img
        canvas.insertAt(img, 0)
        canvas.renderAll()
      })
    } else {
      canvas.renderAll()
    }

    // Keep canvas fitted to its container (uses zoom/pan, preserves BASE coords)
    const ro = new ResizeObserver(() => {
      // Use rAF to avoid layout thrash
      requestAnimationFrame(() => fitCanvasToContainer())
    })
    if (canvasWrapRef.current) ro.observe(canvasWrapRef.current)

    return () => {
      ro.disconnect()
      canvas.dispose()
      fabricCanvasRef.current = null
      textObjectRef.current = null
      qrCodeObjectRef.current = null
      bgObjectRef.current = null
    }
  }, [backgroundImage]) // Recreate when background image changes

  // Update text style when it changes
  useEffect(() => {
    if (textObjectRef.current && fabricCanvasRef.current) {
      const text = textObjectRef.current
      // Don't update if user is currently interacting with the text
      if (!text.isMoving && !text.isSelected) {
        text.set({
          fontSize: textStyle.fontSize,
          fill: textStyle.color,
          fontWeight: textStyle.fontWeight
        })
        fabricCanvasRef.current.renderAll()
      } else {
        // Update style but preserve position
        text.set({
          fontSize: textStyle.fontSize,
          fill: textStyle.color,
          fontWeight: textStyle.fontWeight
        })
        fabricCanvasRef.current.renderAll()
      }
    }
  }, [textStyle])

  // Update text position when it changes externally (but not if user is dragging)
  useEffect(() => {
    if (textObjectRef.current && fabricCanvasRef.current) {
      const text = textObjectRef.current
      // Only update if position changed and text is not being dragged
      const currentX = Math.round(text.left)
      const currentY = Math.round(text.top)
      const newX = Math.round(textPosition.x)
      const newY = Math.round(textPosition.y)
      
      // Only update if there's a significant difference and user isn't dragging
      if ((Math.abs(currentX - newX) > 1 || Math.abs(currentY - newY) > 1) && !text.isMoving) {
        text.set({
          left: textPosition.x,
          top: textPosition.y
        })
        fabricCanvasRef.current.renderAll()
      }
    }
  }, [textPosition.x, textPosition.y])

  // Update QR code position when it changes externally (but not if user is dragging)
  useEffect(() => {
    if (qrCodeObjectRef.current && fabricCanvasRef.current) {
      const qrBox = qrCodeObjectRef.current
      // Only update if position changed and box is not being dragged
      const currentX = Math.round(qrBox.left)
      const currentY = Math.round(qrBox.top)
      const newX = Math.round(qrCodePosition.x)
      const newY = Math.round(qrCodePosition.y)
      
      // Only update if there's a significant difference and user isn't dragging
      if ((Math.abs(currentX - newX) > 1 || Math.abs(currentY - newY) > 1) && !qrBox.isMoving) {
        qrBox.set({
          left: qrCodePosition.x,
          top: qrCodePosition.y
        })
        fabricCanvasRef.current.renderAll()
      }
    }
  }, [qrCodePosition.x, qrCodePosition.y])

  // Update QR code size when it changes externally
  useEffect(() => {
    if (qrCodeObjectRef.current && fabricCanvasRef.current) {
      const qrBox = qrCodeObjectRef.current
      if (!qrBox.isMoving && !qrBox.isSelected) {
        const currentSize = Math.min(qrBox.width * qrBox.scaleX, qrBox.height * qrBox.scaleY)
        if (Math.abs(currentSize - qrCodeSize) > 1) {
          const scale = qrCodeSize / Math.min(qrBox.width, qrBox.height)
          qrBox.set({
            scaleX: scale,
            scaleY: scale
          })
          fabricCanvasRef.current.renderAll()
        }
      }
    }
  }, [qrCodeSize])

  const handleImageUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      onImageUpload(e.target.result)
    }
    reader.readAsDataURL(file)
  }

  const updateTextWithCode = (code) => {
    if (textObjectRef.current && fabricCanvasRef.current) {
      textObjectRef.current.set('text', code)
      fabricCanvasRef.current.renderAll()
    }
  }

  // Show first code if available
  useEffect(() => {
    if (voucherCodes.length > 0) {
      updateTextWithCode(voucherCodes[0])
    } else {
      updateTextWithCode('VOUCHER-CODE')
    }
  }, [voucherCodes])

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 h-full min-h-0 flex flex-col">
      <h2 className="text-xl font-semibold mb-3 shrink-0">Design Canvas</h2>
      
      <div className="space-y-3 min-h-0 flex-1 flex flex-col">
        <div>
          <label className="block mb-2">
            <span className="text-sm text-gray-400 mb-2 block">
              Upload Background Image (JPG/PNG)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleImageUpload}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
            />
          </label>
        </div>

        <div ref={canvasWrapRef} className="bg-gray-900 rounded-lg p-2 border border-gray-700 flex-1 min-h-0">
          <canvas ref={canvasRef} className="w-full h-full rounded" />
        </div>

        <div className="text-sm text-gray-400 shrink-0">
          <p>💡 Drag the text box to position the voucher code</p>
          <p className="mt-1">
            Text Position: X: {Math.round(textPosition.x)}, Y: {Math.round(textPosition.y)}
          </p>
          <p className="mt-1">
            QR Code Position: X: {Math.round(qrCodePosition.x)}, Y: {Math.round(qrCodePosition.y)}, Size: {Math.round(qrCodeSize)}px
          </p>
          <p className="mt-1 text-blue-400">📱 Drag the white dashed box to position the QR code</p>
        </div>
      </div>
    </div>
  )
}

export default DesignCanvas

