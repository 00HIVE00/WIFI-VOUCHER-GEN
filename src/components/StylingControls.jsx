function StylingControls({ style, onStyleChange }) {
  const handleChange = (property, value) => {
    onStyleChange({
      ...style,
      [property]: value
    })
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-semibold mb-4">Text Styling</h2>
      
      <div className="space-y-4">
        {/* Font Size */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Font Size: {style.fontSize}px
          </label>
          <input
            type="range"
            min="12"
            max="72"
            value={style.fontSize}
            onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        {/* Font Weight */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Font Weight
          </label>
          <select
            value={style.fontWeight}
            onChange={(e) => handleChange('fontWeight', e.target.value)}
            className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
            <option value="300">Light</option>
            <option value="500">Medium</option>
            <option value="700">Bold</option>
          </select>
        </div>

        {/* Font Color */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Font Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={style.color}
              onChange={(e) => handleChange('color', e.target.value)}
              className="w-16 h-10 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={style.color}
              onChange={(e) => handleChange('color', e.target.value)}
              className="flex-1 bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="#000000"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-400 mb-2">Preview:</p>
          <div className="bg-gray-900 p-4 rounded-lg">
            <span
              style={{
                fontSize: `${style.fontSize}px`,
                color: style.color,
                fontWeight: style.fontWeight
              }}
            >
              VOUCHER-CODE
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StylingControls

