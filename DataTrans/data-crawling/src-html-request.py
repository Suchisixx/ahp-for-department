import requests

# URL cụ thể bạn đã cung cấp
url = "https://thuviennhadat.vn/ban-can-ho-chung-cu-phuong-05/ban-can-ho-chung-cu-an-binh-trung-tam-quan-5-vi-tri-dep-72m2-3pn-gia-32-ty-pst144882.html"

# Thiết lập User-Agent để giả lập trình duyệt (quan trọng để tránh bị chặn)
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

try:
    # Gửi yêu cầu lấy dữ liệu
    response = requests.get(url, headers=headers, timeout=10)
    
    # Kiểm tra nếu truy cập thành công (status code 200)
    if response.status_code == 200:
        # Ép kiểu encoding về utf-8 để không bị lỗi font tiếng Việt
        response.encoding = 'utf-8'
        html_content = response.text
        
        # Ghi nội dung vào file html
        with open("thuviennhadat_sample.html", "w", encoding="utf-8") as file:
            file.write(html_content)
            
        print("Thành công! File 'thuviennhadat_sample.html' đã được tạo trong thư mục của bạn.")
    else:
        print(f"Không thể lấy dữ liệu. Mã lỗi: {response.status_code}")

except Exception as e:
    print(f"Có lỗi xảy ra: {e}")