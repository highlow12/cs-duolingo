# 스택: 마지막 것이 먼저 나온다

스택은 한쪽 끝인 top에서만 넣고 빼는 자료구조입니다. 마지막에 push한 값이 먼저 pop되므로 LIFO(Last In, First Out)라고 부릅니다.

~~~python
stack = []
stack.append("문서 A")
stack.append("문서 B")
last = stack.pop()
~~~

이 코드에서 last는 "문서 B"입니다. 접시 더미의 맨 위 접시를 먼저 꺼내는 모습으로 생각하면 순서를 기억하기 쉽습니다.
