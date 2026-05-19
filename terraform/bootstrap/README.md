실행 순서
0. :root의 잠시 느슨하게
1. infra:root로 statebucket폴더 apply
2. infra:root로 infra폴더 apply(이때 cross,dns의 어슘롤을 dev로 남겨서 3번이 진행되게끔)
3. dev backend.hcl에 profile을 dev로 한채로 assume_role = {
  role_arn = "arn:aws:iam::123456789012:role/{project_name}-infra-cross-account-backend-role"}추가 하여서 dev폴더 apply
4. prod폴더도 순서3 진행
5. infra폴더에 가서 cross-account-backend-role의 root부분을 전체를 주석처리, 두개의 exec_role 주석해제 (최소권한원칙) (이때 로컬에서도 실행하고 싶다면 dev,prod폴더에서 exec가 gha뿐만 아니라 root도 신뢰해야만, :root로 로그인 ->backend.hcl의 profile로 exec받고 ->  assume_role로 cross롤 받는 구조가 됨)
6. backend.hcl의 profile을 :root에서 :exec로 전부 바꾸고 잘되는지 확인
7. :root의 권한 다시 빡빡하게