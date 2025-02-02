import React from 'react';

function Whiteboard({ room }) {
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [color, setColor] = React.useState('#000000');
  const [brushSize, setBrushSize] = React.useState(2);
  const roomConnection = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    // Set up WebSocket connection for real-time drawing
    roomConnection.current = new WebsimSocket();
    
    roomConnection.current.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'draw') {
        drawLine(context, data.x0, data.y0, data.x1, data.y1, data.color, data.brushSize);
      }
    };

    // Cleanup
    return () => {
      roomConnection.current = null;
    };
  }, []);

  const drawLine = (context, x0, y0, x1, y1, color, size) => {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color;
    context.lineWidth = size;
    context.stroke();
    context.closePath();
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    canvas.getContext('2d').beginPath();
    canvas.getContext('2d').moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const context = canvas.getContext('2d');
    const lastPoint = [
      context.currentX || x,
      context.currentY || y
    ];
    
    drawLine(context, lastPoint[0], lastPoint[1], x, y, color, brushSize);
    
    // Send drawing data to other users
    roomConnection.current.send({
      type: 'draw',
      x0: lastPoint[0],
      y0: lastPoint[1],
      x1: x,
      y1: y,
      color,
      brushSize
    });
    
    context.currentX = x;
    context.currentY = y;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    canvas.getContext('2d').currentX = null;
    canvas.getContext('2d').currentY = null;
  };

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8"
          />
          <select
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            <option value="2">Small</option>
            <option value="5">Medium</option>
            <option value="10">Large</option>
          </select>
        </div>
        <button
          onClick={() => {
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);
          }}
          className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
        >
          Clear
        </button>
      </div>
      
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        className="border rounded bg-white flex-1 w-full"
      />
    </div>
  );
}

export default Whiteboard;