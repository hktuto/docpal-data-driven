
import * as mime from 'mime-types';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';

export const deepCopy = (data: any) => {
  if (!data) return {};
  try {
    return structuredClone(data);
  } catch (error) {
    return JSON.parse(JSON.stringify(data));
  }
};

export function downloadBlob(blob: any, name: string, type = 'application/octet-stream') {
  let blobStream: Blob;
  if(blob instanceof Blob){
    blobStream = blob.slice(0, blob.size, blob.type)
  }else{
    blobStream = new Blob([blob], { type });
  }
  const fileName = calFileNameAndExt(blobStream.type, name);
  const url = window.URL.createObjectURL(blobStream);
  downloadUrl(url, fileName);
}

export function downloadUrl(url: string, name: string) {
  const a = document.createElement('a');
  a.id = 'file_' + Date.now();
  a.href = url;
  a.download = name;
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}


export function calFileNameAndExt(mimeType: string, name: string): string {
  const ext = mime.extension(mimeType);
  console.log('ext', ext)
  // check name include extension
  if (ext && !name.includes(`.${ext}`)) {
    return name + '.' + ext;
  } else {
    return name;
  }

}


export function displayFileSize(value: number) {
  if (!value) return '-';
  const a = 1024;
  const sizeList = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  if (value < a) return `${value}${sizeList[0]}`;
  let getLoga = (a: any, n: any) => {
    // a的x次方=n x=n的对数（x以a为底数 N的对数）
    // 下面的函数返回以 a 为底 n 的对数（即 loga n）
    return Math.floor(Math.log(n) / Math.log(a));
  };

  let logaN = getLoga(a, value);
  let size = (value / Math.pow(a, logaN)).toFixed(2);
  return `${size}${sizeList[logaN]}`;
}


export const copy = (data: any, msg = 'common_copySuccess') => {
  try {
    navigator.clipboard.writeText(data);
  } catch (error) {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.value = data;
    input.focus();
    input.select();
    document.execCommand("Copy");
    document.body.removeChild(input);
  }
  ElMessage.success(msg as string);
};
