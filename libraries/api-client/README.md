

## 使用 Swagger 生成 Axios 和 TypeScript
- [x] 生成 Type
	- [x] 生成多個endporint ( client , admin )
- [x] 測試如果 type  不存在，會不會 error ( 會的 )
- [x] 測試如果 response 的 type 出現改變，會不會 error (會的)
- [x] 查看 **打包大小** ( 103kb/10.38 Gzip) 可能要考慮換 package
- [x] 測試不用 npx 使用node 來生成 (要配合 env)
- [x] 從 env 讀取 endpoint 來生成
- [x] 測試 refresh token
- [ ] 測試 cancel axios
- [x] 測試 global error handling
- [ ] 測試在 CI/CD 打包
- [x] 測試打包後 轉 baseURL 功能



