export function generateRandomPassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const all = upper + lower + digits;

  const getRandom = (source: string, count: number) =>
    Array.from({ length: count }, () => source[Math.floor(Math.random() * source.length)]).join('');

  let password = getRandom(upper, 2) + getRandom(lower, 2) + getRandom(digits, 2) + getRandom(all, 2);
  password = password.split('').sort(() => Math.random() - 0.5).join('');

  const forbidden = ['123','234','345','456','567','678','789','890',
                     'abc','bcd','cde','def','efg','fgh','ghi','hij',
                     'ijk','jkl','klm','lmn','mno','nop','opq','pqr',
                     'qrs','rst','stu','tuv','uvw','vwx','wxy','xyz'];
  if (forbidden.some(seq => password.toLowerCase().includes(seq))) {
    return generateRandomPassword();
  }
  return password;
}
import bcrypt from 'bcryptjs';

/** Транслитерация русских символов для генерации email */
export function transliterate(name: string): string {
  const map: Record<string, string> = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh',
    'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
    'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c',
    'ч':'ch','ш':'sh','щ':'sch','ы':'y','э':'e','ю':'yu','я':'ya'
  };
  const lower = name.toLowerCase();
  let result = '';
  for (const ch of lower) {
    if (map[ch]) result += map[ch];
    else if (/[a-zA-Z0-9]/.test(ch)) result += ch;
    else if (' -_'.includes(ch)) result += '_';
  }
  result = result.replace(/__+/g, '_');
  if (result.length > 10) result = result.slice(0, 10);
  return result.replace(/_$/, '');
}

/** Генерация email из фамилии и имени */
export function makeEmail(surname: string, name: string): string {
  const base = transliterate(surname).toLowerCase();
  const initial = name.charAt(0).toLowerCase();
  const randomSuffix = Math.floor(10 + Math.random() * 90); // двухзначное число
  return `${base}.${initial}${randomSuffix}@internal.uni`;
}

/** Хеширование пароля */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}