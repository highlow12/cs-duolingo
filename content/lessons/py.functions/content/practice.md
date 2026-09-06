## 매개변수와 반환값

매개변수는 호출자가 전달한 값을 함수 안에서 사용할 이름입니다. return은 계산한 값을 호출한 곳으로 돌려보내며 함수 실행도 끝냅니다.

~~~python
def area(width, height):
    return width * height
~~~

area(3, 4)의 반환값은 12입니다. 함수가 화면에 직접 출력하는지, 값을 반환하는지는 다르므로 print와 return을 구분해 읽으세요.
