支持的格式：PDF、Markdown、TXT、Word.docx
• 前端提供文件上传区域，支持拖拽上传和点击选择，支持批量上传多个文件
• 上传后显示文件列表，包含：文件名、格式、大小、解析状态（解析中/已完成/失
败）
• 解析后的统一输出结构：
{
"textbook_id": "book_01",
"filename": "生理学.pdf",
"title": "生理学",
"total_pages": 520,
"total_chars": 385000,
"chapters": [
{
"chapter_id": "ch_01",
"title": "第一章 绪论",
"page_start": 1,
"page_end": 15,
"content": "生理学是研究生物体正常生命活动规律的科学...",
"char_count": 8500
}
]
}
• PDF解析需要处理的问题：章节标题识别（通过字体大小、加粗或正则匹配”第X
章”）、页眉页脚过滤、图表区域跳过
• 大文件处理：逐页解析，不要一次性把整本书加载到内存。
目前上传教材会显示文件过大，后端需要优化大文件的处理逻辑，支持逐页解析并及时返回解析状态给前端。

写一个测试后端api的powershell脚本，可以指定需要上传的pdf文件路径，脚本会调用后端的上传接口，并打印返回的结果。
无命令行参数，在脚本内部设置参数和变量。
powershell -ExecutionPolicy Bypass -File .\tests\Invoke-TextbookUpload.ps1 -FilePath ""C:\Users\lenovo\Downloads\textbooks\03_生理学.pdf"" -WaitForCompletion

发现代码有其他变动我改的，不要改回去