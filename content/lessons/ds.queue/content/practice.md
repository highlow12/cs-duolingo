## 큐와 deque

Python에서는 양 끝에서 효율적으로 넣고 빼는 collections.deque를 큐로 사용할 수 있습니다.

~~~python
from collections import deque
queue = deque(["A"])
queue.append("B")
first = queue.popleft()
~~~

append는 뒤에 넣고 popleft는 앞에서 꺼냅니다. 배열의 앞에서 매번 삭제하면 뒤 원소를 옮기는 비용이 생길 수 있어 적절한 구조를 선택해야 합니다.
