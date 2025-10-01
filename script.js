// Smart Blackboard Application
class SmartBlackboard {
    constructor() {
        this.canvas = document.getElementById('blackboard');
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.currentTool = 'pen';
        this.currentColor = '#ffffff';
        this.currentThickness = 3;
        this.history = [];
        this.historyStep = -1;
        this.startX = 0;
        this.startY = 0;
        this.theme = 'sepia-dark';
        
        this.init();
        this.setupEventListeners();
        this.saveState();
    }

    init() {
        // Set canvas background based on theme
        this.clearCanvas();
        
        // Load saved theme
        const savedTheme = localStorage.getItem('blackboard-theme') || 'sepia-dark';
        this.setTheme(savedTheme);
        
        // Load saved drawing if exists
        const savedDrawing = localStorage.getItem('blackboard-drawing');
        if (savedDrawing) {
            const img = new Image();
            img.onload = () => {
                this.ctx.drawImage(img, 0, 0);
                this.saveState();
            };
            img.src = savedDrawing;
        }
    }

    setupEventListeners() {
        // Canvas events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseout', this.handleMouseUp.bind(this));

        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // Tool buttons
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('line-tool').addEventListener('click', () => this.setTool('line'));
        document.getElementById('rectangle-tool').addEventListener('click', () => this.setTool('rectangle'));
        document.getElementById('circle-tool').addEventListener('click', () => this.setTool('circle'));

        // Color and thickness
        document.getElementById('color-picker').addEventListener('input', (e) => {
            this.currentColor = e.target.value;
        });

        const thicknessSlider = document.getElementById('thickness-slider');
        const thicknessValue = document.getElementById('thickness-value');
        thicknessSlider.addEventListener('input', (e) => {
            this.currentThickness = parseInt(e.target.value);
            thicknessValue.textContent = this.currentThickness;
        });

        // Action buttons
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());
        document.getElementById('clear-btn').addEventListener('click', () => this.confirmClear());
        document.getElementById('save-btn').addEventListener('click', () => this.saveDrawing());
        document.getElementById('load-btn').addEventListener('click', () => this.loadDrawing());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadImage());

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyPress.bind(this));

        // Prevent context menu on canvas
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    handleMouseDown(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        this.startX = e.clientX - rect.left;
        this.startY = e.clientY - rect.top;

        if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
            this.ctx.beginPath();
            this.ctx.moveTo(this.startX, this.startY);
        } else {
            // Save canvas state for shape preview
            this.tempCanvas = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    handleMouseMove(e) {
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        if (this.currentTool === 'pen') {
            this.drawLine(this.startX, this.startY, currentX, currentY);
            this.startX = currentX;
            this.startY = currentY;
        } else if (this.currentTool === 'eraser') {
            this.erase(currentX, currentY);
        } else if (this.currentTool === 'line') {
            this.ctx.putImageData(this.tempCanvas, 0, 0);
            this.drawStraightLine(this.startX, this.startY, currentX, currentY);
        } else if (this.currentTool === 'rectangle') {
            this.ctx.putImageData(this.tempCanvas, 0, 0);
            this.drawRectangle(this.startX, this.startY, currentX, currentY);
        } else if (this.currentTool === 'circle') {
            this.ctx.putImageData(this.tempCanvas, 0, 0);
            this.drawCircle(this.startX, this.startY, currentX, currentY);
        }
    }

    handleMouseUp(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.saveState();
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
    }

    handleTouchEnd(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        this.canvas.dispatchEvent(mouseEvent);
    }

    drawLine(x1, y1, x2, y2) {
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentThickness;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }

    drawStraightLine(x1, y1, x2, y2) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentThickness;
        this.ctx.lineCap = 'round';
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }

    drawRectangle(x1, y1, x2, y2) {
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentThickness;
        this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }

    drawCircle(x1, y1, x2, y2) {
        const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentThickness;
        this.ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
        this.ctx.stroke();
    }

    erase(x, y) {
        const bgColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--canvas-bg').trim();
        this.ctx.strokeStyle = bgColor;
        this.ctx.lineWidth = this.currentThickness * 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
    }

    setTool(tool) {
        this.currentTool = tool;
        
        // Update active button
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`${tool}-tool`).classList.add('active');
        
        // Change cursor
        if (tool === 'eraser') {
            this.canvas.style.cursor = 'not-allowed';
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    clearCanvas() {
        const bgColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--canvas-bg').trim();
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    confirmClear() {
        if (confirm('Are you sure you want to clear the canvas?')) {
            this.clearCanvas();
            this.saveState();
        }
    }

    saveState() {
        // Remove any states after current step
        this.history = this.history.slice(0, this.historyStep + 1);
        
        // Save current state
        this.history.push(this.canvas.toDataURL());
        this.historyStep++;
        
        // Limit history to 50 states
        if (this.history.length > 50) {
            this.history.shift();
            this.historyStep--;
        }
    }

    undo() {
        if (this.historyStep > 0) {
            this.historyStep--;
            this.loadFromHistory();
        }
    }

    redo() {
        if (this.historyStep < this.history.length - 1) {
            this.historyStep++;
            this.loadFromHistory();
        }
    }

    loadFromHistory() {
        const img = new Image();
        img.onload = () => {
            this.clearCanvas();
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = this.history[this.historyStep];
    }

    saveDrawing() {
        const dataURL = this.canvas.toDataURL();
        localStorage.setItem('blackboard-drawing', dataURL);
        this.showNotification('Drawing saved!');
    }

    loadDrawing() {
        const savedDrawing = localStorage.getItem('blackboard-drawing');
        if (savedDrawing) {
            const img = new Image();
            img.onload = () => {
                this.clearCanvas();
                this.ctx.drawImage(img, 0, 0);
                this.saveState();
                this.showNotification('Drawing loaded!');
            };
            img.src = savedDrawing;
        } else {
            this.showNotification('No saved drawing found!');
        }
    }

    downloadImage() {
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `blackboard-${timestamp}.png`;
        link.href = this.canvas.toDataURL();
        link.click();
        this.showNotification('Image downloaded!');
    }

    toggleTheme() {
        const newTheme = this.theme === 'sepia-dark' ? 'sepia-light' : 'sepia-dark';
        this.setTheme(newTheme);
    }

    setTheme(themeName) {
        this.theme = themeName;
        
        // Get current canvas data
        const imageData = this.canvas.toDataURL();
        
        // Update theme attribute
        if (themeName === 'sepia-light') {
            document.documentElement.setAttribute('data-theme', 'sepia-light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        
        // Update color picker default if still at default
        const colorPicker = document.getElementById('color-picker');
        const defaultColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--canvas-default-color').trim();
        
        if (this.currentColor === '#ffffff' || this.currentColor === '#000000') {
            this.currentColor = defaultColor;
            colorPicker.value = defaultColor;
        }
        
        // Wait for CSS transition then redraw with new background
        setTimeout(() => {
            const img = new Image();
            img.onload = () => {
                this.clearCanvas();
                this.ctx.drawImage(img, 0, 0);
            };
            img.src = imageData;
        }, 50);
        
        // Save theme preference
        localStorage.setItem('blackboard-theme', themeName);
        this.showNotification(`Theme: ${themeName === 'sepia-dark' ? 'Sepia Dark' : 'Sepia Light'}`);
    }

    handleKeyPress(e) {
        // Prevent default for our shortcuts
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z' || e.key === 'Z') {
                e.preventDefault();
                this.undo();
            } else if (e.key === 'y' || e.key === 'Y') {
                e.preventDefault();
                this.redo();
            }
        } else {
            switch (e.key.toLowerCase()) {
                case 'p':
                    this.setTool('pen');
                    break;
                case 'e':
                    this.setTool('eraser');
                    break;
                case 'l':
                    this.setTool('line');
                    break;
                case 'r':
                    this.setTool('rectangle');
                    break;
                case 'c':
                    this.setTool('circle');
                    break;
            }
        }
    }

    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: var(--accent);
            color: var(--text-primary);
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px var(--shadow);
            z-index: 1000;
            animation: slideIn 0.3s ease;
            font-weight: 500;
        `;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SmartBlackboard();
});
