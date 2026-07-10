import type { Misconception } from "../types";

export const mockMisconceptions: Misconception[] = [
  {
    id: "mc-swap-no-temp",
    categoryId: "cat-var",
    title: {
      id: "Menukar nilai tanpa variabel sementara",
      en: "Direct swap without temporary variable",
    },
    wrong: {
      id: "A ← B\nB ← A\nMahasiswa mengira baris kedua akan mengembalikan nilai A yang lama ke B, padahal nilai A sudah ditimpa oleh baris pertama.",
      en: "A ← B\nB ← A\nThe student assumes the second line restores the old value of A into B, but A was already overwritten by the first line.",
    },
    correct: {
      id: "TEMP ← A\nA ← B\nB ← TEMP\nNilai asli A disimpan dahulu ke variabel sementara sebelum ditimpa.",
      en: "TEMP ← A\nA ← B\nB ← TEMP\nThe original value of A is stored in a temporary variable before being overwritten.",
    },
    fix: {
      id: "Selalu simpan nilai yang akan ditimpa ke variabel sementara sebelum menjalankan langkah berikutnya.",
      en: "Always store the value that will be overwritten in a temporary variable before running the next step.",
    },
    cause: {
      id: "Mahasiswa belum memahami bahwa perintah ← dijalankan berurutan dan nilai lama dapat tertimpa.",
      en: "Students have not yet understood that the ← operation runs in sequence and can overwrite an old value.",
    },
    pattern: [
      { id: "Muncul pada soal pertukaran nilai dua variabel.", en: "Appears in two-variable value-swap questions." },
      { id: "Jawaban tampak singkat dan 'masuk akal' secara sekilas.", en: "The answer looks short and superficially plausible." },
    ],
    value: {
      id: "Memahami perubahan nilai variabel penting sebelum mempelajari struktur data yang lebih kompleks.",
      en: "Understanding how variable values change is essential before learning more complex data structures.",
    },
    relatedMisconceptionIds: [],
    relatedQuestionIds: ["q-swap"],
  },
  {
    id: "mc-assign-simultaneous",
    categoryId: "cat-var",
    title: {
      id: "Eksekusi baris dianggap bersamaan",
      en: "Lines are assumed to execute at the same time",
    },
    wrong: {
      id: "Mahasiswa membaca 'A ← B' dan 'B ← A' seolah keduanya dieksekusi pada saat bersamaan, seperti pada notasi matematika.",
      en: "The student reads 'A ← B' and 'B ← A' as if both execute at the same instant, similar to mathematical notation.",
    },
    correct: {
      id: "Setiap baris pseudocode dieksekusi satu per satu secara berurutan, bukan serentak.",
      en: "Each line of pseudocode executes one at a time in sequence, not simultaneously.",
    },
    fix: {
      id: "Tekankan bahwa eksekusi pseudocode selalu berurutan, baris demi baris.",
      en: "Emphasize that pseudocode execution is always sequential, line by line.",
    },
    cause: {
      id: "Kebiasaan berpikir dengan notasi matematika (misal sistem persamaan) terbawa ke pemrograman.",
      en: "Habits from mathematical notation (e.g. simultaneous equations) carry over into programming.",
    },
    pattern: [
      { id: "Sering muncul pada mahasiswa tahun pertama.", en: "Common among first-year students." },
    ],
    value: {
      id: "Konsep eksekusi sekuensial adalah fondasi seluruh pemrograman prosedural.",
      en: "Sequential execution is a foundation of all procedural programming.",
    },
    relatedMisconceptionIds: ["mc-swap-no-temp"],
    relatedQuestionIds: ["q-swap"],
  },
  {
    id: "mc-loop-boundary",
    categoryId: "cat-loop",
    title: {
      id: "Batas akhir perulangan tidak tepat",
      en: "Incorrect loop ending boundary",
    },
    wrong: {
      id: "WHILE i < 5 DO ... digunakan untuk mencetak angka 1 sampai 5, sehingga angka 5 tidak pernah tercetak.",
      en: "WHILE i < 5 DO ... is used to print numbers 1 through 5, so 5 is never printed.",
    },
    correct: {
      id: "WHILE i <= 5 DO ... memastikan batas atas ikut diproses.",
      en: "WHILE i <= 5 DO ... ensures the upper bound is included.",
    },
    fix: {
      id: "Cocokkan operator < atau <= dengan kata kunci soal seperti 'sampai' atau 'sampai dengan'.",
      en: "Match < or <= with wording such as 'up to' or 'through' in the question.",
    },
    cause: {
      id: "Kesalahan klasik off-by-one saat menerjemahkan batas 'sampai dengan' ke dalam kondisi perulangan.",
      en: "A classic off-by-one error when translating an inclusive bound into a loop condition.",
    },
    pattern: [
      { id: "Muncul pada perulangan dengan batas inklusif.", en: "Appears in loops with an inclusive bound." },
      { id: "Konsep lain pada perulangan biasanya sudah benar.", en: "Other loop concepts are usually already correct." },
    ],
    value: {
      id: "Ketelitian batas perulangan penting untuk mencegah bug off-by-one pada program yang lebih besar.",
      en: "Careful loop boundaries help prevent off-by-one bugs in larger programs.",
    },
    relatedMisconceptionIds: ["mc-missing-increment", "mc-wrong-init"],
    relatedQuestionIds: ["q-print15", "q-evenloop", "q-printn", "q-tracex"],
  },
  {
    id: "mc-missing-increment",
    categoryId: "cat-loop",
    title: {
      id: "Increment perulangan hilang",
      en: "Missing loop increment",
    },
    wrong: {
      id: "Variabel pengendali perulangan tidak pernah diperbarui di dalam badan perulangan, sehingga perulangan berjalan tak berhingga atau tidak sesuai harapan.",
      en: "The loop control variable is never updated inside the loop body, causing an infinite or unintended loop.",
    },
    correct: {
      id: "Setiap iterasi harus memperbarui variabel pengendali, misalnya i ← i + 1.",
      en: "Every iteration must update the control variable, e.g. i ← i + 1.",
    },
    fix: {
      id: "Tambahkan update seperti i ← i + 1 atau i ← i + 2 sebelum perulangan kembali mengecek kondisi.",
      en: "Add an update such as i ← i + 1 or i ← i + 2 before the loop checks the condition again.",
    },
    cause: {
      id: "Mahasiswa fokus pada logika di dalam perulangan dan lupa bagian yang mengubah kondisi berhenti.",
      en: "Students focus on the logic inside the loop and forget the part that changes the stopping condition.",
    },
    pattern: [
      { id: "Sering terjadi pada perulangan WHILE dibanding FOR.", en: "More common in WHILE loops than FOR loops." },
    ],
    value: {
      id: "Memahami siklus inisialisasi-kondisi-increment adalah dasar semua perulangan.",
      en: "Understanding the init-condition-increment cycle is the basis of all loops.",
    },
    relatedMisconceptionIds: ["mc-loop-boundary"],
    relatedQuestionIds: ["q-evenloop"],
  },
  {
    id: "mc-wrong-init",
    categoryId: "cat-loop",
    title: {
      id: "Nilai awal perulangan salah",
      en: "Wrong loop initial value",
    },
    wrong: {
      id: "Variabel pengendali diinisialisasi dengan nilai yang tidak sesuai batas awal yang diminta, misalnya mulai dari 0 padahal soal meminta mulai dari 1.",
      en: "The control variable is initialized with a value that does not match the required starting bound, e.g. starting at 0 when the question asks to start at 1.",
    },
    correct: {
      id: "Nilai inisialisasi harus disesuaikan dengan batas awal yang diminta soal.",
      en: "The initial value must match the starting bound required by the question.",
    },
    fix: {
      id: "Tentukan nilai awal dari batas pertama yang diminta soal sebelum menulis kondisi perulangan.",
      en: "Set the initial value from the first required number before writing the loop condition.",
    },
    cause: {
      id: "Kebiasaan selalu memulai dari 0 seperti indeks array dibawa ke konteks yang berbeda.",
      en: "The habit of always starting from 0, like array indices, is carried into a different context.",
    },
    pattern: [
      { id: "Sering terjadi ketika soal meminta batas mulai dari angka selain 0.", en: "Common when the question asks for a starting bound other than 0." },
    ],
    value: {
      id: "Inisialisasi yang tepat mencegah hasil bergeser satu posisi.",
      en: "Correct initialization prevents results from being shifted by one position.",
    },
    relatedMisconceptionIds: ["mc-loop-boundary"],
    relatedQuestionIds: ["q-printn"],
  },
  {
    id: "mc-offbyone-array",
    categoryId: "cat-array",
    title: {
      id: "Indeks array bergeser satu (off-by-one)",
      en: "Array index off-by-one",
    },
    wrong: {
      id: "Perulangan menelusuri indeks dari 1 sampai N pada array yang berindeks 0 sampai N-1, sehingga elemen terakhir terlewat atau terjadi akses di luar batas.",
      en: "The loop traverses indices 1 to N on an array indexed 0 to N-1, skipping the last element or causing an out-of-bounds access.",
    },
    correct: {
      id: "Perulangan seharusnya menelusuri indeks 0 sampai N-1 untuk array berukuran N.",
      en: "The loop should traverse indices 0 to N-1 for an array of size N.",
    },
    fix: {
      id: "Selalu cocokkan rentang indeks perulangan dengan ukuran array dan basis indeksnya.",
      en: "Always match the loop index range with the array size and its index base.",
    },
    cause: {
      id: "Kebingungan antara penomoran elemen sehari-hari (mulai dari 1) dengan indeks array (mulai dari 0).",
      en: "Confusion between everyday element numbering (starting at 1) and array indexing (starting at 0).",
    },
    pattern: [
      { id: "Muncul pada soal pencarian nilai maksimum/minimum dalam array.", en: "Appears in max/min search questions over arrays." },
    ],
    value: {
      id: "Penguasaan indeks array adalah dasar untuk struktur data yang lebih kompleks.",
      en: "Mastering array indices is foundational for more complex data structures.",
    },
    relatedMisconceptionIds: ["mc-loop-boundary"],
    relatedQuestionIds: ["q-arraymax"],
  },
  {
    id: "mc-ifelse-missing-else",
    categoryId: "cat-ifelse",
    title: {
      id: "Kondisi alternatif tidak ditangani",
      en: "Alternative condition not handled",
    },
    wrong: {
      id: "Hanya kondisi benar yang ditangani dengan IF, sementara kasus lain yang seharusnya masuk cabang ELSE tidak dipertimbangkan sama sekali.",
      en: "Only the true condition is handled with IF, while other cases that should fall into an ELSE branch are not considered at all.",
    },
    correct: {
      id: "Kasus selain kondisi utama perlu ditangani dengan ELSE atau ELSE IF.",
      en: "Cases outside the main condition need to be handled with ELSE or ELSE IF.",
    },
    fix: {
      id: "Tambahkan ELSE atau ELSE IF untuk hasil yang belum tercakup oleh kondisi utama.",
      en: "Add ELSE or ELSE IF for outcomes not covered by the main condition.",
    },
    cause: {
      id: "Mahasiswa hanya memikirkan skenario 'jalur bahagia' dan lupa mempertimbangkan kasus tepi.",
      en: "Students only think through the 'happy path' scenario and forget to consider edge cases.",
    },
    pattern: [
      { id: "Muncul pada soal validasi dengan lebih dari satu kemungkinan hasil.", en: "Appears in validation questions with more than one possible outcome." },
    ],
    value: {
      id: "Percabangan yang lengkap membuat output program tetap jelas untuk semua kondisi.",
      en: "Complete branching keeps program output clear for every condition.",
    },
    relatedMisconceptionIds: ["mc-condition-reversed"],
    relatedQuestionIds: ["q-evenodd", "q-triangle"],
  },
  {
    id: "mc-condition-reversed",
    categoryId: "cat-bool",
    title: {
      id: "Kondisi boolean terbalik",
      en: "Reversed boolean condition",
    },
    wrong: {
      id: "Kondisi ditulis terbalik dari yang seharusnya, misalnya menggunakan 'x MOD 2 = 1' untuk memeriksa bilangan genap.",
      en: "The condition is written the opposite of what is intended, e.g. using 'x MOD 2 = 1' to check for an even number.",
    },
    correct: {
      id: "Kondisi harus disesuaikan dengan makna logis yang benar-benar diinginkan, misalnya 'x MOD 2 = 0' untuk genap.",
      en: "The condition must match the intended logical meaning, e.g. 'x MOD 2 = 0' for even.",
    },
    fix: {
      id: "Uji kondisi dengan nilai contoh sebelum menganggapnya benar.",
      en: "Test the condition with sample values before assuming it is correct.",
    },
    cause: {
      id: "Kekeliruan saat menerjemahkan definisi genap/ganjil atau syarat lain ke dalam ekspresi boolean.",
      en: "Confusion when translating the definition of even/odd or other conditions into a boolean expression.",
    },
    pattern: [
      { id: "Sering muncul pada soal paritas bilangan atau validasi rentang.", en: "Common in number-parity questions or range validation." },
    ],
    value: {
      id: "Ketelitian menyusun kondisi boolean mencegah bug logika yang sulit dilacak.",
      en: "Careful boolean condition construction prevents hard-to-trace logic bugs.",
    },
    relatedMisconceptionIds: ["mc-ifelse-missing-else", "mc-and-or-confusion"],
    relatedQuestionIds: ["q-evenodd", "q-triangle"],
  },
  {
    id: "mc-function-no-return",
    categoryId: "cat-func",
    title: {
      id: "Fungsi tidak mengembalikan nilai",
      en: "Function missing return value",
    },
    wrong: {
      id: "Fungsi menghitung hasil dan mencetaknya langsung, tetapi tidak menggunakan RETURN sehingga pemanggil tidak menerima nilai apa pun.",
      en: "The function computes a result and prints it directly, but never uses RETURN, so the caller receives no value.",
    },
    correct: {
      id: "Fungsi harus mengirimkan hasil ke pemanggil menggunakan pernyataan RETURN.",
      en: "A function must send its result back to the caller using a RETURN statement.",
    },
    fix: {
      id: "Ganti PRINT hasil di dalam fungsi dengan RETURN hasil, dan cetak nilainya di luar fungsi jika diperlukan.",
      en: "Replace PRINT result inside the function with RETURN result, and print the value outside the function if needed.",
    },
    cause: {
      id: "Mahasiswa belum membedakan tanggung jawab prosedur (menampilkan) dengan fungsi (mengembalikan nilai).",
      en: "Students have not yet distinguished the responsibility of a procedure (displaying output) from a function (returning a value).",
    },
    pattern: [
      { id: "Muncul pada soal fungsi yang hasilnya akan dipakai lebih lanjut.", en: "Appears in function questions whose result is meant to be reused." },
    ],
    value: {
      id: "Pemahaman RETURN penting untuk komposisi fungsi dalam program yang lebih besar.",
      en: "Understanding RETURN is important for composing functions in larger programs.",
    },
    relatedMisconceptionIds: [],
    relatedQuestionIds: ["q-squarefn"],
  },
  {
    id: "mc-io-order",
    categoryId: "cat-io",
    title: {
      id: "Urutan input/output tertukar",
      en: "Input/output order confusion",
    },
    wrong: {
      id: "Program mencoba mencetak atau mengolah nilai sebelum nilai tersebut selesai dibaca dari input.",
      en: "The program tries to print or process a value before it has finished being read from input.",
    },
    correct: {
      id: "Seluruh input yang dibutuhkan harus dibaca terlebih dahulu sebelum diproses atau dicetak.",
      en: "All required input must be read first before it is processed or printed.",
    },
    fix: {
      id: "Susun ulang urutan pernyataan: READ semua input yang diperlukan, baru lakukan proses dan PRINT.",
      en: "Reorder the statements: READ all required input first, then process and PRINT.",
    },
    cause: {
      id: "Mahasiswa belum terbiasa dengan urutan eksekusi baris demi baris pada operasi I/O.",
      en: "Students are not yet used to the line-by-line execution order of I/O operations.",
    },
    pattern: [
      { id: "Muncul pada soal yang melibatkan dua atau lebih nilai input.", en: "Appears in questions involving two or more input values." },
    ],
    value: {
      id: "Urutan I/O yang benar penting agar program berinteraksi dengan pengguna secara benar.",
      en: "Correct I/O ordering ensures the program interacts with the user correctly.",
    },
    relatedMisconceptionIds: [],
    relatedQuestionIds: ["q-sumio"],
  },
  {
    id: "mc-trace-state-loss",
    categoryId: "cat-trace",
    title: {
      id: "Kehilangan status variabel saat menelusuri",
      en: "Losing variable state while tracing",
    },
    wrong: {
      id: "Saat menelusuri pseudocode, mahasiswa tidak memperbarui nilai variabel pada setiap langkah sehingga nilai akhir yang dilaporkan salah.",
      en: "While tracing pseudocode, the student does not update variable values at each step, so the reported final value is wrong.",
    },
    correct: {
      id: "Setiap langkah penelusuran harus mencatat nilai terbaru setiap variabel yang berubah.",
      en: "Every tracing step must record the latest value of each variable that changes.",
    },
    fix: {
      id: "Gunakan tabel penelusuran (trace table) untuk mencatat nilai variabel di setiap iterasi.",
      en: "Use a trace table to record variable values at each iteration.",
    },
    cause: {
      id: "Beban kerja mental menelusuri banyak langkah sekaligus tanpa alat bantu pencatatan.",
      en: "The mental load of tracing many steps at once without a recording aid.",
    },
    pattern: [
      { id: "Muncul pada soal penelusuran perulangan dengan banyak iterasi.", en: "Appears in tracing questions with many loop iterations." },
    ],
    value: {
      id: "Kemampuan menelusuri kode akurat penting untuk debugging di kemudian hari.",
      en: "Accurate code tracing ability is important for future debugging skills.",
    },
    relatedMisconceptionIds: ["mc-loop-boundary"],
    relatedQuestionIds: ["q-tracex"],
  },
  {
    id: "mc-and-or-confusion",
    categoryId: "cat-bool",
    title: {
      id: "Kekeliruan operator AND/OR",
      en: "AND/OR confusion",
    },
    wrong: {
      id: "Operator OR digunakan pada kondisi yang seharusnya memakai AND, misalnya 'x >= 1 OR x <= 10' untuk memeriksa rentang, yang selalu bernilai benar.",
      en: "The OR operator is used where AND was needed, e.g. 'x >= 1 OR x <= 10' to check a range, which is always true.",
    },
    correct: {
      id: "Untuk memastikan nilai berada di dalam rentang, kedua syarat harus dipenuhi sekaligus menggunakan AND: 'x >= 1 AND x <= 10'.",
      en: "To ensure a value is within a range, both conditions must hold at once using AND: 'x >= 1 AND x <= 10'.",
    },
    fix: {
      id: "Uji kondisi dengan nilai di luar rentang yang diharapkan untuk memastikan operator sudah tepat.",
      en: "Test the condition with values outside the expected range to confirm the operator is correct.",
    },
    cause: {
      id: "Kerancuan antara makna 'dan' dalam bahasa sehari-hari dengan operator logika AND/OR.",
      en: "Confusion between everyday use of 'and' and the logical AND/OR operators.",
    },
    pattern: [
      { id: "Sering muncul pada soal validasi rentang nilai.", en: "Common in value-range validation questions." },
    ],
    value: {
      id: "Operator logika yang tepat penting untuk validasi data yang benar.",
      en: "Correct logical operators are essential for correct data validation.",
    },
    relatedMisconceptionIds: ["mc-condition-reversed"],
    relatedQuestionIds: ["q-boolrange"],
  },
];
