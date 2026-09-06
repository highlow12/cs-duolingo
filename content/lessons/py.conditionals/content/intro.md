# 조건문으로 실행을 선택하기

프로그램은 조건의 결과에 따라 서로 다른 코드를 실행할 수 있습니다. Python에서는 `if` 뒤에 조건을 쓰고, 조건이 참일 때 실행할 코드를 들여쓰기로 표시합니다.

```python
score = 75

if score >= 60:
    print("pass")
else:
    print("retry")
```

`score >= 60`이 참이므로 이 코드는 `pass`를 출력합니다. `else` 블록은 조건이 거짓일 때 실행됩니다.
