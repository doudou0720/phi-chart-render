import base64
import sys
import os
import re
import subprocess

def copy_to_clipboard(text):
    try:
        # Termux (Android)
        if os.path.exists('/data/data/com.termux/files/usr/bin/termux-clipboard-set'):
            subprocess.run(['termux-clipboard-set'], input=text.encode(), check=True)
            return True
        
        # Linux
        if os.name == 'posix':
            try:
                subprocess.run(['xclip', '-selection', 'clipboard'], input=text.encode(), check=True)
                return True
            except (subprocess.CalledProcessError, FileNotFoundError):
                pass
        
        # macOS
        if sys.platform == 'darwin':
            try:
                subprocess.run(['pbcopy'], input=text.encode(), check=True)
                return True
            except (subprocess.CalledProcessError, FileNotFoundError):
                pass
        
        # Windows
        if sys.platform == 'win32':
            try:
                import pyperclip
                pyperclip.copy(text)
                return True
            except ImportError:
                try:
                    subprocess.run('clip', shell=True, input=text.encode(), check=True)
                    return True
                except (subprocess.CalledProcessError, FileNotFoundError):
                    pass
        return False
    except Exception:
        return False

def main():
    # 验证skip_config
    while True:
        skip_config = input("skip_config (true/false): ").strip().lower()
        if skip_config in ['true', 'false']:
            break
        print("错误：只能输入 'true' 或 'false'（小写）")

    # 获取chart_url输入
    chart_input = input("chart_url (URL或base64): ").strip()

    # 处理chart_url输入
    if re.match(r'^https?://', chart_input, re.IGNORECASE):
        print("检测到URL，转换为base64...")
        chart_url = base64.b64encode(chart_input.encode()).decode()
    else:
        # 基本验证是否像base64
        if re.fullmatch(r'[A-Za-z0-9+/=]+', chart_input):
            chart_url = chart_input
        else:
            sys.exit("错误：输入不是有效的URL或base64格式")

    # 生成URL
    base_url = "https://phirender.ghpage.doudou0528.cloudns.ch/"
    url = f"{base_url}?skip_config={skip_config}&chart_url={chart_url}"
    backup_url = f"https://phirender.mz.doudou0528.cloudns.ch/?skip_config={skip_config}&chart_url={chart_url}"
    # 输出并复制到剪贴板
    print(f"生成URL: {url}")
    print(f"备用URL:{backup_url}")
    if copy_to_clipboard(url):
        print("已复制到剪贴板")
    else:
        print("警告：无法复制到剪贴板，请手动复制", file=sys.stderr)

if __name__ == "__main__":
    main()