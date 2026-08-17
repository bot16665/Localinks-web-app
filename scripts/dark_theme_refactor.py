import os
import re

root = r"C:\Users\Azhar Shaikh.HSNCU0\Desktop\Desktop-web-app\my-app"
skip_dirs = {'.next', 'node_modules', '.git', 'design-reference'}

replacements = [
    (r'bg-surface-container-low(?!est)', 'bg-surface-container'),
    (r'shadow-\[0px_4px_20px_rgba\(0,0,0,0\.04\)\]', 'shadow-lg'),
    (r'text-on-background', 'text-on-surface'),
    (r'bg-surface-bright(?!/|;)', 'bg-surface-container-lowest'),
    (r'rounded-xl p-md ambient-shadow-md', 'rounded-2xl p-md shadow-lg border border-outline-variant/30'),
    (r'rounded-xl shadow-\[0px_4px_20px_rgba\(0,0,0,0\.06\)\]', 'rounded-2xl shadow-lg border border-outline-variant/30'),
]

for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in skip_dirs]
    for filename in filenames:
        if filename.endswith(('.tsx', '.ts', '.jsx', '.js', '.css')):
            filepath = os.path.join(dirpath, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                original = content
                for pattern, replacement in replacements:
                    content = re.sub(pattern, replacement, content)
                if content != original:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Updated: {filepath}")
            except Exception as e:
                print(f"Error: {filepath}: {e}")
