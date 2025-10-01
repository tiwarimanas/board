// Smart Blackboard Application
class SmartBlackboard {
    constructor() {
        // Canvas setup
        this.canvas = document.getElementById('blackboard');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        // State management
        this.currentTool = 'pen';
        this.currentColor = '#ffffff';
        this.brushSize = 3;
        this.isDrawing = false;
        this.currentTheme = 'dark';
        
        // Drawing state
        this.startX = 0;
        this.startY = 0;
        this.snapshot = null;
        
        // History management (undo/redo)
        this.history = [];
        this.historyStep = -1;
        this.maxHistory = 50;
        
        // Text tool state
        this.textPosition = null;
        
        // Initialize
        this.initializeElements();
        this.attachEventListeners();
        this.updateCanvasBackground();
        this.saveState();
        
        // Set initial color preview
        this.updateColorPreview();
    }
    
    initializeElements() {
        // Tool buttons
        this.toolButtons = document.querySelectorAll('[data-tool]');
        this.colorPicker = document.getElementById('colorPicker');
        this.brushSizeSlider = document.getElementById('brushSize');
        this.brushSizeValue = document.getElementById('brushSizeValue');
        
        // Action buttons
        this.undoBtn = document.getElementById('undoBtn');
        this.redoBtn = document.getElementById('redoBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.loadBtn = document.getElementById('loadBtn');
        this.fileInput = document.getElementById('fileInput');
        
        // Theme buttons
        this.themeButtons = document.querySelectorAll('[data-theme]');
        
        // Status elements
        this.toolStatus = document.getElementById('toolStatus');
        this.positionStatus = document.getElementById('positionStatus');
        this.themeStatus = document.getElementById('themeStatus');
        
        // Text modal
        this.textModal = document.getElementById('textModal');
        this.textInput = document.getElementById('textInput');
        this.textOkBtn = document.getElementById('textOkBtn');
        this.textCancelBtn = document.getElementById('textCancelBtn');
    }
    
    attachEventListeners() {
        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.startDraw(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDraw());
        this.canvas.addEventListener('mouseout', () => this.stopDraw());
        this.canvas.addEventListener('mousemove', (e) => this.updatePosition(e));
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e, 'start'));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouch(e, 'move'));
        this.canvas.addEventListener('touchend', () => this.stopDraw());
        
        // Tool buttons
        this.toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentTool = btn.dataset.tool;
                this.updateToolUI();
                this.updateCanvasCursor();
            });
        });
        
        // Color picker
        this.colorPicker.addEventListener('input', (e) => {
            this.currentColor = e.target.value;
            this.updateColorPreview();
        });
        
        // Brush size
        this.brushSizeSlider.addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            this.brushSizeValue.textContent = this.brushSize;
        });
        
        // Action buttons
        this.undoBtn.addEventListener('click', () => this.undo());
        this.redoBtn.addEventListener('click', () => this.redo());
        this.clearBtn.addEventListener('click', () => this.clearCanvas());
        this.saveBtn.addEventListener('click', () => this.saveImage());
        this.loadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.loadImage(e));
        
        // Theme buttons
        this.themeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentTheme = btn.dataset.theme;
                this.updateTheme();
            });
        });
        
        // Text modal
        this.textOkBtn.addEventListener('click', () => this.addText());
        this.textCancelBtn.addEventListener('click', () => this.hideTextModal());
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addText();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Window resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const padding = 40; // Account for padding
        
        // Save current canvas content
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        tempCtx.drawImage(this.canvas, 0, 0);
        
        // Resize canvas
        this.canvas.width = rect.width - padding;
        this.canvas.height = rect.height - padding;
        
        // Restore canvas content
        this.updateCanvasBackground();
        this.ctx.drawImage(tempCanvas, 0, 0);
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    startDraw(e) {
        const pos = this.getMousePos(e);
        this.startX = pos.x;
        this.startY = pos.y;
        
        if (this.currentTool === 'text') {
            this.textPosition = { x: this.startX, y: this.startY };
            this.showTextModal();
            return;
        }
        
        this.isDrawing = true;
        
        // Save snapshot for shape tools
        if (['line', 'rectangle', 'circle'].includes(this.currentTool)) {
            this.snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Start path for pen and eraser
        if (['pen', 'eraser'].includes(this.currentTool)) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.startX, this.startY);
        }
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        
        const pos = this.getMousePos(e);
        
        this.ctx.lineWidth = this.brushSize;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        if (this.currentTool === 'pen') {
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        } else if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        } else if (this.currentTool === 'line') {
            this.drawLine(pos.x, pos.y);
        } else if (this.currentTool === 'rectangle') {
            this.drawRectangle(pos.x, pos.y);
        } else if (this.currentTool === 'circle') {
            this.drawCircle(pos.x, pos.y);
        }
    }
    
    stopDraw() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.saveState();
        }
    }
    
    drawLine(endX, endY) {
        this.ctx.putImageData(this.snapshot, 0, 0);
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.beginPath();
        this.ctx.moveTo(this.startX, this.startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
    }
    
    drawRectangle(endX, endY) {
        this.ctx.putImageData(this.snapshot, 0, 0);
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.beginPath();
        this.ctx.rect(this.startX, this.startY, endX - this.startX, endY - this.startY);
        this.ctx.stroke();
    }
    
    drawCircle(endX, endY) {
        this.ctx.putImageData(this.snapshot, 0, 0);
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.globalCompositeOperation = 'source-over';
        const radius = Math.sqrt(Math.pow(endX - this.startX, 2) + Math.pow(endY - this.startY, 2));
        this.ctx.beginPath();
        this.ctx.arc(this.startX, this.startY, radius, 0, 2 * Math.PI);
        this.ctx.stroke();
    }
    
    showTextModal() {
        this.textModal.classList.add('show');
        this.textInput.value = '';
        this.textInput.focus();
    }
    
    hideTextModal() {
        this.textModal.classList.remove('show');
        this.textPosition = null;
    }
    
    addText() {
        const text = this.textInput.value.trim();
        if (text && this.textPosition) {
            this.ctx.font = `${this.brushSize * 8}px Arial`;
            this.ctx.fillStyle = this.currentColor;
            this.ctx.textBaseline = 'top';
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.fillText(text, this.textPosition.x, this.textPosition.y);
            this.saveState();
        }
        this.hideTextModal();
    }
    
    handleTouch(e, type) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent(
            type === 'start' ? 'mousedown' : type === 'move' ? 'mousemove' : 'mouseup',
            {
                clientX: touch.clientX,
                clientY: touch.clientY
            }
        );
        this.canvas.dispatchEvent(mouseEvent);
    }
    
    saveState() {
        // Remove any states after current step
        this.history = this.history.slice(0, this.historyStep + 1);
        
        // Save current state
        this.history.push(this.canvas.toDataURL());
        
        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyStep++;
        }
        
        this.updateHistoryButtons();
    }
    
    undo() {
        if (this.historyStep > 0) {
            this.historyStep--;
            this.restoreState(this.history[this.historyStep]);
            this.updateHistoryButtons();
        }
    }
    
    redo() {
        if (this.historyStep < this.history.length - 1) {
            this.historyStep++;
            this.restoreState(this.history[this.historyStep]);
            this.updateHistoryButtons();
        }
    }
    
    restoreState(dataUrl) {
        const img = new Image();
        img.onload = () => {
            this.updateCanvasBackground();
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = dataUrl;
    }
    
    updateHistoryButtons() {
        this.undoBtn.disabled = this.historyStep <= 0;
        this.redoBtn.disabled = this.historyStep >= this.history.length - 1;
        
        if (this.undoBtn.disabled) {
            this.undoBtn.style.opacity = '0.5';
        } else {
            this.undoBtn.style.opacity = '1';
        }
        
        if (this.redoBtn.disabled) {
            this.redoBtn.style.opacity = '0.5';
        } else {
            this.redoBtn.style.opacity = '1';
        }
    }
    
    clearCanvas() {
        if (confirm('Are you sure you want to clear the canvas?')) {
            this.updateCanvasBackground();
            this.saveState();
        }
    }
    
    updateCanvasBackground() {
        const bgColor = getComputedStyle(document.body).getPropertyValue('--canvas-bg').trim();
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    saveImage() {
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `blackboard-${timestamp}.png`;
        link.href = this.canvas.toDataURL();
        link.click();
    }
    
    loadImage(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                this.updateCanvasBackground();
                this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
                this.saveState();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    updateToolUI() {
        this.toolButtons.forEach(btn => {
            if (btn.dataset.tool === this.currentTool) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        const toolNames = {
            pen: 'Pen',
            eraser: 'Eraser',
            line: 'Line',
            rectangle: 'Rectangle',
            circle: 'Circle',
            text: 'Text'
        };
        
        this.toolStatus.textContent = `Tool: ${toolNames[this.currentTool]}`;
    }
    
    updateCanvasCursor() {
        this.canvas.className = '';
        if (this.currentTool === 'eraser') {
            this.canvas.classList.add('eraser-cursor');
        } else if (this.currentTool === 'text') {
            this.canvas.classList.add('text-cursor');
        }
    }
    
    updateColorPreview() {
        const preview = document.querySelector('.color-preview');
        preview.style.backgroundColor = this.currentColor;
    }
    
    updatePosition(e) {
        const pos = this.getMousePos(e);
        this.positionStatus.textContent = `Position: ${Math.round(pos.x)}, ${Math.round(pos.y)}`;
    }
    
    updateTheme() {
        document.body.setAttribute('data-theme', this.currentTheme);
        
        this.themeButtons.forEach(btn => {
            if (btn.dataset.theme === this.currentTheme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        const themeNames = {
            dark: 'Dark Sepia',
            light: 'Light Sepia'
        };
        
        this.themeStatus.textContent = `Theme: ${themeNames[this.currentTheme]}`;
        
        // Update canvas background with new theme
        setTimeout(() => {
            const currentState = this.canvas.toDataURL();
            this.updateCanvasBackground();
            const img = new Image();
            img.onload = () => {
                this.ctx.drawImage(img, 0, 0);
            };
            img.src = currentState;
        }, 50);
    }
    
    handleKeyboard(e) {
        // Prevent shortcuts when typing in text input
        if (e.target.tagName === 'INPUT') return;
        
        // Tool shortcuts
        if (e.key.toLowerCase() === 'p') {
            this.currentTool = 'pen';
            this.updateToolUI();
            this.updateCanvasCursor();
        } else if (e.key.toLowerCase() === 'e') {
            this.currentTool = 'eraser';
            this.updateToolUI();
            this.updateCanvasCursor();
        } else if (e.key.toLowerCase() === 'l') {
            this.currentTool = 'line';
            this.updateToolUI();
            this.updateCanvasCursor();
        } else if (e.key.toLowerCase() === 'r') {
            this.currentTool = 'rectangle';
            this.updateToolUI();
            this.updateCanvasCursor();
        } else if (e.key.toLowerCase() === 'c') {
            this.currentTool = 'circle';
            this.updateToolUI();
            this.updateCanvasCursor();
        } else if (e.key.toLowerCase() === 't') {
            this.currentTool = 'text';
            this.updateToolUI();
            this.updateCanvasCursor();
        }
        
        // Undo/Redo
        if (e.ctrlKey || e.metaKey) {
            if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            } else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
                e.preventDefault();
                this.redo();
            }
        }
        
        // Brush size adjustment
        if (e.key === '[') {
            this.brushSize = Math.max(1, this.brushSize - 1);
            this.brushSizeSlider.value = this.brushSize;
            this.brushSizeValue.textContent = this.brushSize;
        } else if (e.key === ']') {
            this.brushSize = Math.min(50, this.brushSize + 1);
            this.brushSizeSlider.value = this.brushSize;
            this.brushSizeValue.textContent = this.brushSize;
        }
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SmartBlackboard();
});
