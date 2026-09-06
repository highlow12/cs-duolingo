# 값의 종류를 구분하기

Python의 모든 값에는 자료형(type)이 있습니다. 자료형은 그 값이 어떤 종류인지, 어떤 연산을 할 수 있는지 알려 줍니다.

```python
count = 42          # int: 소수점 없는 정수
temperature = 21.5  # float: 소수점이 있는 실수
name = "Ada"        # str: 문자열
finished = False     # bool: 참 또는 거짓
```

`int`, `float`, `str`, `bool`은 대표적인 기본 자료형입니다. `bool` 값은 반드시 대문자로 시작하는 `True` 또는 `False`로 씁니다. 문자열은 작은따옴표나 큰따옴표로 감쌉니다.

`type(value)`를 사용하면 값의 자료형을 확인할 수 있습니다.

```python
print(type(42))
# <class 'int'>
```

출력 결과의 `int` 부분은 42가 정수라는 뜻입니다. 값을 계산하기 전에 자료형을 확인하면 어떤 연산이 가능한지 예상하기 쉽습니다.
