// All user-facing text lives here. No Thai literals in components.
export const th = {
  appTitle: 'Inven2Food',
  nav: {
    home: 'หน้าหลัก',
    pantry: 'คลังวัตถุดิบ',
    ingredients: 'วัตถุดิบ',
    menus: 'รายการอาหารและสูตร',
    cookingHistory: 'ประวัติทำอาหาร',
    shopping: 'รายการซื้อของ',
  },
  common: {
    signOut: 'ออกจากระบบ',
    save: 'บันทึก',
    cancel: 'ยกเลิก',
    loading: 'กำลังโหลด...',
    baht: 'บาท',
    datePlaceholder: 'วว/ดด/ปป',
  },
  login: {
    title: 'เข้าสู่ระบบ',
    email: 'Email',
    password: 'Password',
    submit: 'เข้าสู่ระบบ',
    submitting: 'กำลังเข้าสู่ระบบ...',
  },
  home: {
    heading: 'หน้าหลัก',
  },
  units: {
    g: 'กรัม',
    ml: 'มิลลิลิตร',
    piece: 'ชิ้น',
  },
  storage: {
    freezer: 'ช่องแช่แข็ง',
    fridge: 'ตู้เย็น',
    dry: 'ของแห้ง',
  },
  errors: {
    UNKNOWN: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง',
    INVALID_CREDENTIALS: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    INSUFFICIENT_STOCK: 'วัตถุดิบในคลังไม่พอ',
    INVALID_QTY: 'ปริมาณไม่ถูกต้อง',
    RECIPE_EMPTY: 'สูตรยังไม่มีวัตถุดิบ',
    ALREADY_CANCELLED: 'รายการนี้ถูกยกเลิกไปแล้ว',
    UNIT_MISMATCH: 'หน่วยไม่ตรงกับวัตถุดิบ',
    EXPIRY_IN_PAST: 'วันหมดอายุผ่านไปแล้ว',
    NOT_FOUND: 'ไม่พบข้อมูลที่ต้องการ',
  },
} as const

export type ErrorCode = Exclude<keyof typeof th.errors, 'UNKNOWN'>

/** Map a DB/auth error code to Thai text; unknown or raw text gets the generic message. */
export function errorMessage(code: string): string {
  if (code !== 'UNKNOWN' && Object.hasOwn(th.errors, code)) {
    return th.errors[code as ErrorCode]
  }
  return th.errors.UNKNOWN
}
