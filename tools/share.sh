#!/bin/bash

# 验证skip_config输入
while true; do
    read -p "skip_config (true/false): " skip_config
    if [[ "$skip_config" == "true" || "$skip_config" == "false" ]]; then
        break
    else
        echo "错误：只能输入 'true' 或 'false'（小写）"
    fi
done

# 获取chart_url输入
read -p "chart_url (URL或base64): " chart_input

# 处理chart_url输入
if [[ "$chart_input" =~ ^https?:// ]]; then
    echo "检测到URL，转换为base64..."
    chart_url=$(echo -n "$chart_input" | base64 -w 0)
else
    # 基本验证是否像base64
    if [[ "$chart_input" =~ ^[A-Za-z0-9+/=]+$ ]]; then
        chart_url="$chart_input"
    else
        echo "错误：输入不是有效的URL或base64格式" >&2
        exit 1
    fi
fi

# 生成URL
base_url="https://phirender.ghpage.doudou0528.cloudns.ch/"
url="${base_url}?skip_config=${skip_config}&chart_url=${chart_url}"
url_backup="https://phirender.mz.doudou0528.cloudns.ch/?skip_config=${skip_config}&chart_url=${chart_url}"
# 输出并复制到剪贴板
echo "生成URL: $url"
echo "备用URL: $url_backup"
# 尝试多种剪贴板方法
copied=false
if command -v termux-clipboard-set &> /dev/null; then
    echo -n "$url" | termux-clipboard-set && copied=true
elif command -v xclip &> /dev/null; then
    echo -n "$url" | xclip -selection clipboard && copied=true
elif command -v pbcopy &> /dev/null; then
    echo -n "$url" | pbcopy && copied=true
elif command -v clip &> /dev/null; then
    echo -n "$url" | clip && copied=true
fi

if $copied; then
    echo "已复制到剪贴板"
else
    echo "警告：无法复制到剪贴板，请手动复制" >&2
fi