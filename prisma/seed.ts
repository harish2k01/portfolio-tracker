async function main() {
  console.log("No seed data is inserted. This app uses real user-entered data only.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
